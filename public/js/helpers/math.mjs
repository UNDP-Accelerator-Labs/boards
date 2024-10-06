export const computeCentroid = function (node) {
	const { x, y } = d3.select(node).datum();
	const { width: w, height: h } = node.getBoundingClientRect();
	const centroid = [ x + w / 2, y + h / 2 ];
	const threshold = computeDistance(centroid, [x, y])
	return { centroid, threshold };
}
export const computeDistance = function (p1, p2) {
	const [ x1, y1 ] = p1;
	const [ x2, y2 ] = p2;
	return Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
}
export const checkContain = function (p, node) {
	const [ x, y ] = p;
	const { x: x1, y: y1, width: w1, height: h1 } = node.getBoundingClientRect();

	if (x1 <= x && x1 + w1 >= x && y1 <= y && y1 + h1 >= y) return node;
	else return null;
}