<p align="center">
  <img src="https://coworkingview.com/brand/coworkingview-wordmark.svg" alt="CoworkingView" width="320">
</p>

# n8n-nodes-coworkingview

An [n8n](https://n8n.io) community node for the [CoworkingView](https://coworkingview.com) catalogue
of coworking spaces, private offices, flexible desks and meeting rooms. Search a city, fetch one
space with every published price, or read a city's market rates, inside any workflow, and from n8n's
AI Agent, since the node is usable as a tool.

**No API key and no credentials.** The node calls the public
[CoworkingView API](https://coworkingview.com/en/mcp) (`https://api.coworkingview.com/v1`), which is rate-limited.

## Install

In n8n: **Settings → Community Nodes → Install**, enter `n8n-nodes-coworkingview`.

Self-hosted from the command line, in `~/.n8n/nodes`:

```bash
npm install n8n-nodes-coworkingview
```

See n8n's [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Operations

| Resource | Operation | Returns |
| --- | --- | --- |
| Space | **Search** | One item per space in a city: title, slug, district, brand, entry price, amenities. Filters: workspace type, district, brand, team size, max price. |
| Space | **Get** | One space: address, description, amenities, every pricing option and a link to its page |
| Market Rate | **Get** | One item per city: median, quartiles and sample size per workspace type (`figures`), plus the licence and date in `source`. Leave the city empty for every published city. |
| City | **Get Many** | One item per city, with its districts and how many spaces each has |

City slugs look like `berlin`, `madrid`, `barcelona`, `london`, `munich`, `amsterdam`, `dubai`; use
**City → Get Many** for the full list.

## Example workflows

- Every Monday, search new private offices for 10 people in [Berlin](https://coworkingview.com/en/coworking/berlin)
  and post them to Slack.
- Track the median flex-desk price in [Madrid](https://coworkingview.com/en/coworking/madrid) and
  [Barcelona](https://coworkingview.com/en/coworking/barcelona) in a Google Sheet, monthly.
- Give an AI Agent the node as a tool so it can answer "find me a meeting room in London under £60 an hour".

## Reading the numbers

- Market rates are medians over the priced spaces in a city. Check `sampleSize` before calling a
  figure "the market rate". They are the figures behind the
  [Coworking Price Index](https://coworkingview.com/en/tools/price-index), licensed CC BY 4.0: credit
  CoworkingView and link to the source when you republish them.
- Prices are what operators publish. Each space's `webUrl` links to its page with the current offer.

## Compatibility

Tested with n8n 2.x. Requires Node.js 20 or newer.

## More ways in

- MCP server for AI assistants: [coworkingview-mcp](https://github.com/coworkingview/coworkingview-mcp)
- Node-RED: [node-red-contrib-coworkingview](https://github.com/coworkingview/node-red-contrib-coworkingview)
- Go: [coworkingview-go](https://github.com/coworkingview/coworkingview-go)
- OpenAPI 3.1: [coworkingview.com/openapi.json](https://coworkingview.com/openapi.json)

## License

MIT © [CoworkingView](https://coworkingview.com)
