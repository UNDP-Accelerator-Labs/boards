const staticElement = function (_sel, _method, _element, _class) {
	return _sel[typeof _method === 'object' ? _method[0] : _method](_element, typeof _method === 'object' ? _method[1] : null)
		.attr('class', _class)
}
const dynamicElement = function (_sel, _method, _element, _class, _data, _key) { // THIS REPLACES DOMnode
	const node = _sel.selectAll(_class ? `${_element.replace(/xhtml:/g, '')}.${_class.replace(/\s/g, '.')}` : `${_element.replace(/xhtml:/g, '')}`)
		.data(_data ? (typeof _data === 'function' ? d => _data(d) : _data) : d => [d],
		(d, i) => _key ? (typeof _key === 'function' ? _key(d) : d[_key]) : i)
	node.exit().remove()
	return node.enter()
		[typeof _method === 'object' ? _method[0] : _method](_element, typeof _method === 'object' ? _method[1] : null)
		.attr('class', _class ? _class : '')
	.merge(node)
}

d3.selection.prototype.insertElem = function (_before, _element, _class) {
	return new staticElement(this, ['insert', _before], _element, _class ? _class : '')
}
d3.selection.prototype.insertElems = function (_before, _element, _class, _data, _key) {
	return new dynamicElement(this, ['insert', _before], _element, _class ? _class : '', _data, _key)
}
d3.selection.prototype.addElem = function (_element, _class) {
	return new staticElement(this, 'append', _element, _class ? _class : '')
}
d3.selection.prototype.addElems = function (_element, _class, _data, _key) {
	return new dynamicElement(this, 'append', _element, _class ? _class : '', _data, _key)
}
d3.selection.prototype.findAncestor = function (_class) {
	if (!this.node().classList || this.node().nodeName === 'BODY') return false;
	if (this.classed(_class)) return this;
	return d3.select(this.node().parentNode) && d3.select(this.node().parentNode).findAncestor(_class);
}
d3.selection.prototype.moveToFront = function() {
	return this.each(function(){
		this.parentNode.appendChild(this);
	});
}
d3.selection.prototype.moveTo = function(_target) {
	return this.each(function(){
		d3.select(`.${_target}`).node().appendChild(this);
	});
}
d3.selection.prototype.moveUpDOM = function(_limit) {
	if (!d3.select(this.node().parentNode).classed(_limit)) {
		return this.each(function(){
			this.parentNode.parentNode.appendChild(this);
		})
	} else return false;
}