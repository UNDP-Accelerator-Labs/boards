export const endpoint = function (platform, query) {
	const origin = new URL(`https://${platform}.sdg-innovation-commons.org`);
	
	if (platform === 'blogapi') {
		// THE API STRUCTURE IS SLIGHTLY DIFFERENT FOR BLOGS
		const documents = new URL('articles', origin);
		return { 
			origin,
			// stats: `${stats.origin}${stats.pathname}?${query}`,
			documents: `${documents.origin}${documents.pathname}?${query}`,
		}

	} else {
		const stats = new URL('apis/fetch/statistics', origin);
		const documents = new URL('apis/fetch/pads', origin);

		return { 
			origin,
			stats: `${stats.origin}${stats.pathname}?${query}`,
			documents: `${documents.origin}${documents.pathname}?${query}`,
		}
	}
}