import { ITriggerFunctions } from 'n8n-core';
import {
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	INodePropertyOptions,
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';
import ipc from 'node-ipc';
// import { uid } from 'uid';
import { options } from './DiscordTrigger.node.options';
import {
	connection,
	getChannels as getChannelsHelper,
	getRoles as getRolesHelper,
	execution,
	ICredentials,
} from './bot/helpers';

const nodeDescription: INodeTypeDescription = {
	displayName: 'Discord Trigger',
	name: 'discordTrigger',
	icon: 'file:discord.svg',
	group: ['trigger', 'discord'],
	version: 1,
	description: 'Trigger based on Discord events',
	eventTriggerDescription: '',
	mockManualExecution: true,
	activationMessage: 'Your workflow will now trigger executions on the event you have defined.',
	defaults: {
		name: 'Discord Trigger',
	},
	inputs: [],
	outputs: ['main'],
	credentials: [
		{
			name: 'discordApi',
			required: true,
		},
	],
	webhooks: [
		{
			name: 'default',
			httpMethod: 'POST',
			responseMode: 'onReceived',
			path: 'webhook',
		},
	],
	properties: options,
};

export class DiscordTrigger implements INodeType {
	description: INodeTypeDescription = nodeDescription;

	methods = {
		loadOptions: {
			async getChannels(): Promise<INodePropertyOptions[]> {
				return await getChannelsHelper(this).catch((e) => e);
			},
			async getRoles(): Promise<INodePropertyOptions[]> {
				return await getRolesHelper(this).catch((e) => e);
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();

		return {
			workflowData: [this.helpers.returnJsonArray(req.body)],
		};
	}

	async trigger(this: ITriggerFunctions): Promise<undefined> {
		const activationMode = this.getActivationMode() as 'activate' | 'update' | 'init' | 'manual';
		if (activationMode !== 'manual') {
			const webhookHost = this.getRestApiUrl().replace('/rest', '');

			const credentials = (await this.getCredentials('discordApi').catch(
				(e) => e,
			)) as any as ICredentials;
			await connection(credentials).catch((e) => e);

			ipc.connectTo('bot', () => {
				const { webhookId } = this.getNode();

				const parameters: any = {};
				Object.keys(this.getNode().parameters).forEach((key) => {
					parameters[key] = this.getNodeParameter(key, '') as any;
				});

				ipc.of.bot.emit('trigger', {
					...parameters,
					webhookHost,
					webhookId,
					active: this.getWorkflow().active,
				});
			});
		}
		return;
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// @ts-ignore
		const executionId = this.getExecutionId();
		const input = this.getInputData();
		const credentials = (await this.getCredentials('discordApi')) as any as ICredentials;
		const placeholderId = input[0].json?.placeholderId as string;
		const channelId = input[0].json?.channelId as string;
		const userId = input[0].json?.userId as string;
		const content = input[0].json?.content as string;

		await execution(executionId, placeholderId, channelId, credentials.apiKey, userId).catch(
			(e) => e,
		);
		const returnData: INodeExecutionData[] = [];
		returnData.push({
			json: { content, channelId, userId },
		});
		return this.prepareOutputData(returnData);
	}
}