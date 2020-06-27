#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { Network } from  '../lib/network';
import { Ecs } from  '../lib/ecs';
import { JenkinsMaster } from  '../lib/jenkins-master';
import { JenkinsWorker } from  '../lib/jenkins-worker';

const stackName = 'Jenkins';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;
const serviceDiscoveryNamespace = 'jenkins';

const app = new cdk.App();
const network = new Network(app, stackName + 'Network');
const ecsCluster = new Ecs(app, stackName + 'Init', {
  vpc: network.vpc,
  serviceDiscoveryNamespace: serviceDiscoveryNamespace
});

const jenkinsWorker = new JenkinsWorker(app, stackName + "Worker", {
  vpc: network.vpc,
  ecsCluster: ecsCluster
});
new JenkinsMaster(app, stackName + 'JenkinsMaster', {
  ecsCluster: ecsCluster,
  network: network,
  worker: jenkinsWorker,
  env: {
    account: account,
    region: region,
  }
});


app.synth();
