import { App } from "cdktn";
import { MyStack } from "./stacks/my-stack.js";

const app = new App();

new MyStack(app, "cdktn-gcp-cron-function-dev");

app.synth();
