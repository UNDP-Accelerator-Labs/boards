export const endpoint = function (platform, query) {
	const origin = new URL(`https://${platform}.sdg-innovation-commons.org`);
	const stats = new URL('apis/fetch/statistics', origin);
	const pads = new URL('apis/fetch/pads', origin);

	return { 
		origin,
		stats: `${stats.origin}${stats.pathname}?${query}`,
		pads: `${pads.origin}${pads.pathname}?${query}`,
	}
}