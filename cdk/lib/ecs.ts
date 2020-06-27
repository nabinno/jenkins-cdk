import * as ecs from '@aws-cdk/aws-ecs';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';

interface EcsProps extends cdk.StackProps {
  vpc: ec2.IVpc,
  serviceDiscoveryNamespace: string,
}

export class Ecs extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly cluster: ecs.ICluster;

  constructor(scope: cdk.App, id: string, props: EcsProps) {
    super(scope, id, props);

    const serviceDiscoveryNamespace = props.serviceDiscoveryNamespace;
    this.vpc = props.vpc;

    /**
     * ECS Cluster
     */
    this.cluster = new ecs.Cluster(this, "ECSCluster", {
      vpc: this.vpc,
      defaultCloudMapNamespace: {
        name: serviceDiscoveryNamespace
      }
    });
  }
}
