import * as ecr from '@aws-cdk/aws-ecr-assets';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as sd from '@aws-cdk/aws-servicediscovery';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as cdk from '@aws-cdk/core';
import { Network } from  './network';
import { Ecs } from  './ecs';
import { JenkinsWorker } from  './jenkins-worker';


interface JenkinsMasterProps extends cdk.StackProps {
  ecsCluster: Ecs,
  network: Network,
  worker: JenkinsWorker
}

export class JenkinsMaster extends cdk.Stack {
  public readonly containerImage: ecr.DockerImageAsset;
  public readonly workerSecurityGroup: ec2.SecurityGroup;
  public readonly workerExecutionRole: iam.Role;
  public readonly workerTaskRole: iam.Role;
  public readonly workerLogsGroup: logs.LogGroup;
  public readonly workerLogStream: logs.LogStream;

  constructor(scope: cdk.App, id: string, props: JenkinsMasterProps) {
    super(scope, id, props);

    const ecsCluster = props.ecsCluster
    const network = props.network
    const worker = props.worker
    const account = props.env?.account;
    const region = props.env?.region;

    /**
     * ECR
     */
    const containerImage = new ecr.DockerImageAsset(this, "JenkinsMasterDockerImage", {
      directory: '../docker/master/'
    });

    /**
     * Fargate
     */
    const jenkinsMasterServiceMain = new ecs_patterns.ApplicationLoadBalancedFargateService(this, "JenkinsMasterService", {
      cpu: 512,
      memoryLimitMiB: 1024,
      cluster: ecsCluster.cluster,
      desiredCount: 1,
      enableECSManagedTags: true,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(containerImage.repository),
        containerPort: 8080,
        enableLogging: true,
        environment: {
          // https://github.com/jenkinsci/docker/blob/master/README.md#passing-jvm-parameters
          'JAVA_OPTS': '-Djenkins.install.runSetupWizard=false',
          // https://github.com/jenkinsci/configuration-as-code-plugin/blob/master/README.md#getting-started
          'CASC_JENKINS_CONFIG': '/config-as-code.yaml',
          'network_stack': network.stackName,
          'cluster_stack': ecsCluster.stackName,
          'worker_stack': worker.stackName,
          'cluster_arn': ecsCluster.cluster.clusterArn,
          'aws_region': "ap-northeast-1",
          'jenkins_url': "http://master.jenkins:8080",
          'subnet_ids': (network.vpc.privateSubnets.map(function(x) { x.subnetId })).join(','),
          'security_group_ids': worker.workerSecurityGroup.securityGroupId,
          'execution_role_arn': worker.workerExecutionRole.roleArn,
          'task_role_arn': worker.workerTaskRole.roleArn,
          'worker_log_group': worker.workerLogsGroup.logGroupName,
          'worker_log_stream_prefix': worker.workerLogStream.logStreamName
        },
      },
      cloudMapOptions: {
        name: "master",
        dnsRecordType: 'A'
      },
    })

    // Fargate: Service
    const jenkinsMasterService = jenkinsMasterServiceMain.service;
    jenkinsMasterService.taskDefinitionDefaultContainer.addPortMappings({
      containerPort: 50000, hostPort: 50000
    });
    jenkinsMasterService.connections.allowFrom({
      other: worker.workerSecurityGroup,
      portRange: {
        protocol: ec2.Protocol.TCP,
        stringRepresentation: 'Master to Worker 50000',
        fromPort: 50000,
        toPort: 50000
      }
    });
    jenkinsMasterService.connections.allowFrom({
      other: worker.workerSecurityGroup,
      portRange: {
        protocol: ec2.Protocol.TCP,
        stringRepresentation: 'Master to Worker 8080',
        fromPort: 8080,
        toPort: 8080
      }
    })

    // Fargate: TaskDefinition
    const jenkinsMasterTask = jenkinsMasterService.taskDefinition;
    jenkinsMasterTask.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:ListClusters",
          "ecs:DescribeContainerInstances",
          "ecs:ListTaskDefinitions",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks"
        ],
        resources: ["*"],
      })
    );
    jenkinsMasterTask.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ["ecs:ListContainerInstances"],
        resources: [ecsCluster.cluster.clusterArn]
      })
    )
    jenkinsMasterTask.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ["ecs:RunTask"],
        resources: [`arn:aws:ecs:${region}:${account}:task-definition/fargate-workers*`]
      })
    )
    jenkinsMasterTask.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ["ecs:StopTask"],
        resources: [`arn:aws:ecs:${region}:${account}:task/*`],
        conditions: {
          "ForAnyValue:ArnEquals": {
            "ecs:cluster": ecsCluster.cluster.clusterArn
          }
        }
      })
    )
    jenkinsMasterTask.add_to_task_role_policy(
      new iam.PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [
          worker.workerTaskRole.roleArn,
          worker.workerExecutionRole.roleArn
        ]
      })
    )

    // END OF JENKINS ECS PLUGIN IAM POLICIES #
  }
}
