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
export const computeAbsCoordinates = function (sel, ref) {
	const { x, y } = sel.node().getBoundingClientRect();
	const { x: ox, y: oy } = ref.node().getBoundingClientRect();
	let { k } = ref.datum();
	return computeCoordinates(k, x, y, ox, oy);
}
export const computeCoordinates = function (k, x, y, ox, oy) {
	if (!k) k = 1;
	return [ (x - ox) / k, (y - oy) / k ];
}
function getPosition (sel) {
	let { x, y } = sel.datum();
	if (sel.classed('child') || !x || !y) {
		const { x: bx, y: by } = sel.node().getBoundingClientRect();
		x = bx;
		y = by;
	}
	return [ x, y ];
}
export const cartesianToPolar = function (x, y, offset) {
	if (!offset) offset = [0, 0];
	x = x - offset[0];
	y = y - offset[1];
	const angle = Math.atan2(y, x);
	const length = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
	return [angle, length];
};