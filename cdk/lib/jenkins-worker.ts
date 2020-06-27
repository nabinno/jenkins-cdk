import * as ecr from '@aws-cdk/aws-ecr-assets';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as cdk from '@aws-cdk/core';
import { Ecs } from  './ecs';

interface JenkinsWorkerProps extends cdk.StackProps {
  vpc: ec2.IVpc,
  ecsCluster: Ecs,
}

export class JenkinsWorker extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly ecsCluster: Ecs;
  public readonly containerImage: ecr.DockerImageAsset;
  public readonly workerSecurityGroup: ec2.SecurityGroup;
  public readonly workerExecutionRole: iam.Role;
  public readonly workerTaskRole: iam.Role;
  public readonly workerLogsGroup: logs.LogGroup;
  public readonly workerLogStream: logs.LogStream;

  constructor(scope: cdk.App, id: string, props: JenkinsWorkerProps) {
    super(scope, id, props);

    this.vpc = props.vpc;
    this.ecsCluster = props.ecsCluster

    this.containerImage = new ecr.DockerImageAsset(this, "JenkinsWorkerDockerImage", {
      directory: '../docker/worker/'
    });

    this.workerSecurityGroup = new ec2.SecurityGroup(this, "WorkerSecurityGroup", {
      vpc: this.vpc,
      description: "Jenkins Worker access to Jenkins Master",
    });

    this.workerExecutionRole = new iam.Role(this, "WorkerExecutionRole", {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    })
    this.workerExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'));

    this.workerTaskRole = new iam.Role(this, "WorkerTaskRole", {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    this.workerLogsGroup = new logs.LogGroup(this, "WorkerLogGroup", {
      retention: logs.RetentionDays.ONE_DAY
    });

    this.workerLogStream = new logs.LogStream(this, "WorkerLogStream", {
      logGroup: this.workerLogsGroup
    });
  }
}
