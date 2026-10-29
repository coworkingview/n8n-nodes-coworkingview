import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';

/**
 * CoworkingView catalogue API (https://api.coworkingview.com/v1). Reads are
 * open and need no API key. `/v1/rankings` is deliberately absent: it answers
 * 410 Gone in production.
 */
export const BASE_URL = 'https://api.coworkingview.com';

const SLUG = /^[a-z0-9-]{1,200}$/;

const PRICING_OPTION_TYPES = [
	{ name: 'Any', value: '' },
	{ name: 'Private Office', value: 'private_office' },
	{ name: 'Exclusive Area', value: 'exclusive_bereich' },
	{ name: 'Fixed Desk', value: 'fix_desk' },
	{ name: 'Flex Desk', value: 'flex_desk' },
	{ name: 'Day Pass', value: 'day_pass' },
	{ name: 'Meeting Room', value: 'meeting_room' },
	{ name: 'Virtual Office', value: 'virtual_office' },
	{ name: 'Event Space', value: 'event_space' },
	{ name: 'Membership', value: 'membership' },
];

const LOCALES = [
	{ name: 'English', value: 'en' },
	{ name: 'German', value: 'de' },
	{ name: 'Spanish', value: 'es' },
];

export class CoworkingView implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CoworkingView',
		name: 'coworkingView',
		icon: { light: 'file:coworkingview.svg', dark: 'file:coworkingview.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Search coworking spaces, private offices and market rates by city',
		defaults: { name: 'CoworkingView' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Space', value: 'space' },
					{ name: 'Market Rate', value: 'marketRate' },
					{ name: 'City', value: 'city' },
				],
				default: 'space',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['space'] } },
				options: [
					{ name: 'Search', value: 'search', action: 'Search spaces in a city', description: 'List coworking spaces in a city' },
					{ name: 'Get', value: 'get', action: 'Get a space', description: 'Get one space with every pricing option' },
				],
				default: 'search',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['marketRate'] } },
				options: [
					{ name: 'Get', value: 'get', action: 'Get market rates', description: 'Median prices per workspace type for a city or country' },
				],
				default: 'get',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['city'] } },
				options: [
					{ name: 'Get Many', value: 'getAll', action: 'List cities', description: 'Every city in the catalogue, with its districts' },
				],
				default: 'getAll',
			},
			{
				displayName: 'City',
				name: 'city',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'berlin',
				description: 'City slug, e.g. berlin, madrid, barcelona, london. Use City → Get Many to list them.',
				displayOptions: { show: { resource: ['space'], operation: ['search'] } },
			},
			{
				displayName: 'Space Slug',
				name: 'slug',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'signature-potsdamer-platz-berlin',
				description: 'The slug of a space, as returned by Space → Search',
				displayOptions: { show: { resource: ['space'], operation: ['get'] } },
			},
			{
				displayName: 'Workspace Type',
				name: 'pricingOptionType',
				type: 'options',
				options: PRICING_OPTION_TYPES,
				default: '',
				displayOptions: { show: { resource: ['space'], operation: ['search'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 50 },
				default: 10,
				description: 'Max number of results to return',
				displayOptions: { show: { resource: ['space'], operation: ['search'] } },
			},
			{
				displayName: 'Options',
				name: 'searchOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['space'], operation: ['search'] } },
				options: [
					{ displayName: 'Page', name: 'page', type: 'number', typeOptions: { minValue: 1, maxValue: 500 }, default: 1 },
					{ displayName: 'District', name: 'zone', type: 'string', default: '', placeholder: 'mitte' },
					{ displayName: 'Operator', name: 'operator', type: 'string', default: '', placeholder: 'wework' },
					{ displayName: 'Min Capacity', name: 'minCapacity', type: 'number', typeOptions: { minValue: 1 }, default: 1 },
					{ displayName: 'Max Price', name: 'maxPrice', type: 'number', typeOptions: { minValue: 0 }, default: 0 },
					{ displayName: 'Currency', name: 'currency', type: 'string', default: '', placeholder: 'EUR', description: 'ISO 4217 code for Max Price' },
				],
			},
			{
				displayName: 'City',
				name: 'rateCity',
				type: 'string',
				default: '',
				placeholder: 'berlin',
				description: 'City slug. Leave empty for every published city.',
				displayOptions: { show: { resource: ['marketRate'] } },
			},
			{
				displayName: 'Currency',
				name: 'rateCurrency',
				type: 'string',
				default: '',
				placeholder: 'USD',
				description: 'ISO 4217 code to convert the figures to. Empty keeps each city\'s own currency.',
				displayOptions: { show: { resource: ['marketRate'] } },
			},
			{
				displayName: 'Language',
				name: 'locale',
				type: 'options',
				options: LOCALES,
				default: 'en',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const request = buildRequest(this, i);
				const body = (await this.helpers.httpRequest(request)) as IDataObject;
				for (const json of toItems(this.getNodeParameter('resource', i) as string, body)) {
					out.push({ json, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				if (error instanceof NodeOperationError) throw error;
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}
		return [out];
	}
}

function slugParam(ctx: IExecuteFunctions, name: string, i: number, label: string): string {
	const raw = String(ctx.getNodeParameter(name, i, '')).trim().toLowerCase();
	if (!SLUG.test(raw)) {
		throw new NodeOperationError(ctx.getNode(), `${label} "${raw}" is not a slug (e.g. berlin)`, { itemIndex: i });
	}
	return raw;
}

function currencyParam(ctx: IExecuteFunctions, value: unknown, i: number): string | undefined {
	const code = String(value ?? '').trim().toUpperCase();
	if (!code) return undefined;
	if (!/^[A-Z]{3}$/.test(code)) {
		throw new NodeOperationError(ctx.getNode(), `Currency "${code}" is not an ISO 4217 code`, { itemIndex: i });
	}
	return code;
}

export function buildRequest(ctx: IExecuteFunctions, i: number): IHttpRequestOptions {
	const resource = ctx.getNodeParameter('resource', i) as string;
	const operation = ctx.getNodeParameter('operation', i) as string;
	const qs: IDataObject = { locale: ctx.getNodeParameter('locale', i, 'en') as string };
	let url: string;

	if (resource === 'space' && operation === 'get') {
		url = `/v1/properties/${encodeURIComponent(slugParam(ctx, 'slug', i, 'Space slug'))}`;
	} else if (resource === 'space') {
		url = '/v1/properties';
		qs.city = slugParam(ctx, 'city', i, 'City');
		qs.pageSize = ctx.getNodeParameter('limit', i, 10) as number;
		const type = ctx.getNodeParameter('pricingOptionType', i, '') as string;
		if (type) qs.pricingOptionType = type;
		const o = ctx.getNodeParameter('searchOptions', i, {}) as IDataObject;
		if (o.page) qs.page = o.page;
		if (o.zone) qs.zone = String(o.zone).trim().toLowerCase();
		if (o.operator) qs.operator = String(o.operator).trim().toLowerCase();
		if (o.minCapacity && Number(o.minCapacity) > 1) qs.minCapacity = o.minCapacity;
		if (o.maxPrice) qs.maxPrice = o.maxPrice;
		const currency = currencyParam(ctx, o.currency, i);
		if (currency) qs.currency = currency;
	} else if (resource === 'marketRate') {
		url = '/v1/market/rates';
		if (String(ctx.getNodeParameter('rateCity', i, '')).trim()) qs.city = slugParam(ctx, 'rateCity', i, 'City');
		const currency = currencyParam(ctx, ctx.getNodeParameter('rateCurrency', i, ''), i);
		if (currency) qs.currency = currency;
	} else {
		url = '/v1/geo/bootstrap';
	}

	return {
		method: 'GET',
		baseURL: BASE_URL,
		url,
		qs,
		json: true,
		headers: { Accept: 'application/json' },
	};
}

/**
 * One n8n item per space or city; a single object stays one item. Market rates
 * become one item per city, each carrying the licence and date it was published
 * under, so a downstream node can credit the figures (CC BY 4.0) on its own.
 */
export function toItems(resource: string, body: IDataObject): IDataObject[] {
	const data = (body?.data ?? body) as IDataObject | IDataObject[];
	if (resource === 'city') {
		const cities = (data as IDataObject).cities;
		return Array.isArray(cities) ? (cities as IDataObject[]) : [];
	}
	if (resource === 'marketRate') {
		const { cities, unpublished, ...about } = data as IDataObject;
		void unpublished;
		const list = Array.isArray(cities) ? (cities as IDataObject[]) : [];
		const source = { asOf: about.asOf, license: about.license, licenseUrl: about.licenseUrl, attribution: about.attribution };
		return list.map((city) => ({ ...city, source }));
	}
	if (Array.isArray(data)) return data;
	return [data];
}
