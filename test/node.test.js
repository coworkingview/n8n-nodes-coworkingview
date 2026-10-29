'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CoworkingView, buildRequest, toItems } = require('../dist/nodes/CoworkingView/CoworkingView.node.js');

/** Just enough of IExecuteFunctions to run the node over a list of items. */
function context(paramsPerItem, { httpRequest, continueOnFail = false } = {}) {
	const calls = [];
	return {
		calls,
		getInputData: () => paramsPerItem.map(() => ({ json: {} })),
		getNodeParameter: (name, i, fallback) => {
			const value = paramsPerItem[i][name];
			return value === undefined ? fallback : value;
		},
		getNode: () => ({ name: 'CoworkingView', type: 'n8n-nodes-coworkingview.coworkingView', typeVersion: 1, parameters: {} }),
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequest: async (options) => {
				calls.push(options);
				return httpRequest(options);
			},
		},
	};
}

test('search builds the properties query', () => {
	const ctx = context([{ resource: 'space', operation: 'search', city: 'Berlin', limit: 5, pricingOptionType: 'private_office', searchOptions: { zone: 'Mitte', maxPrice: 900, currency: 'eur' } }]);
	const r = buildRequest(ctx, 0);
	assert.equal(r.baseURL, 'https://api.coworkingview.com');
	assert.equal(r.url, '/v1/properties');
	assert.deepEqual(r.qs, { locale: 'en', city: 'berlin', pageSize: 5, pricingOptionType: 'private_office', zone: 'mitte', maxPrice: 900, currency: 'EUR' });
});

test('get, market rates and cities hit the right paths', () => {
	assert.equal(buildRequest(context([{ resource: 'space', operation: 'get', slug: 'some-space', locale: 'de' }]), 0).url, '/v1/properties/some-space');
	const rates = buildRequest(context([{ resource: 'marketRate', operation: 'get', rateCity: 'madrid', rateCurrency: 'usd' }]), 0);
	assert.equal(rates.url, '/v1/market/rates');
	assert.deepEqual(rates.qs, { locale: 'en', city: 'madrid', currency: 'USD' });
	const all = buildRequest(context([{ resource: 'marketRate', operation: 'get', rateCity: '' }]), 0);
	assert.deepEqual(all.qs, { locale: 'en' });
	assert.equal(buildRequest(context([{ resource: 'city', operation: 'getAll' }]), 0).url, '/v1/geo/bootstrap');
});

test('bad input is refused before any request', () => {
	assert.throws(() => buildRequest(context([{ resource: 'space', operation: 'search', city: 'new york' }]), 0), /not a slug/);
	assert.throws(() => buildRequest(context([{ resource: 'space', operation: 'get', slug: '' }]), 0), /not a slug/);
	assert.throws(() => buildRequest(context([{ resource: 'marketRate', operation: 'get', rateCurrency: 'euro' }]), 0), /ISO 4217/);
});

test('lists become one item per result, cities included', () => {
	assert.deepEqual(toItems('space', { data: [{ slug: 'a' }, { slug: 'b' }] }), [{ slug: 'a' }, { slug: 'b' }]);
	assert.deepEqual(toItems('space', { data: { slug: 'a' } }), [{ slug: 'a' }]);
	assert.deepEqual(toItems('city', { data: { cities: [{ slug: 'berlin' }] } }), [{ slug: 'berlin' }]);
	const rates = toItems('marketRate', { data: { cities: [{ city: { slug: 'madrid' } }, { city: { slug: 'berlin' } }], unpublished: [], asOf: '2026-10-01', license: 'L', licenseUrl: 'U', attribution: 'A', totalProperties: 9 } });
	assert.equal(rates.length, 2);
	assert.deepEqual(rates[0], { city: { slug: 'madrid' }, source: { asOf: '2026-10-01', license: 'L', licenseUrl: 'U', attribution: 'A' } });
});

test('execute runs every input item and pairs the outputs', async () => {
	const ctx = context(
		[
			{ resource: 'space', operation: 'search', city: 'berlin', limit: 2 },
			{ resource: 'space', operation: 'get', slug: 'x' },
		],
		{ httpRequest: async (o) => (o.url === '/v1/properties' ? { data: [{ slug: 'a' }, { slug: 'b' }] } : { data: { slug: 'x' } }) },
	);
	const [out] = await new CoworkingView().execute.call(ctx);
	assert.deepEqual(out.map((o) => [o.json.slug, o.pairedItem.item]), [['a', 0], ['b', 0], ['x', 1]]);
	assert.equal(ctx.calls.length, 2);
});

test('continueOnFail turns an error into an item', async () => {
	const ctx = context([{ resource: 'space', operation: 'get', slug: 'gone' }], {
		continueOnFail: true,
		httpRequest: async () => {
			throw new Error('Request failed with status code 404');
		},
	});
	const [out] = await new CoworkingView().execute.call(ctx);
	assert.match(out[0].json.error, /404/);
});

test('the description is well formed', () => {
	const d = new CoworkingView().description;
	assert.equal(d.name, 'coworkingView');
	assert.equal(d.usableAsTool, true);
	const names = d.properties.map((p) => p.name);
	for (const n of ['resource', 'operation', 'city', 'slug', 'limit', 'locale']) assert.ok(names.includes(n), n);
	assert.ok(!JSON.stringify(d).includes('rankings'), 'the retired rankings endpoint must not come back');
});
