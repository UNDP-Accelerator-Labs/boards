export const uuid = 'uuid';

const currentURL = new URL(window.location);
const currentPath = currentURL.pathname.split('/');
export const wallId = currentPath[currentPath.length - 1];

export const lock = {
	set: function (uuid, node) { node['__user_lock__'] = uuid; return false; },
	get: function (node) { return node['__user_lock__']; },
	check: function (uuid, node) { return node['__user_lock__'] === uuid; }
}

export const tree = {
	set: function (tree, leaf) {
		if (this.getNodes(tree)?.length) return this.update(tree, leaf);
		else return `${leaf}`;
		return false;
	},
	update: function (tree, leaf) {
		if (!this.getNodes(tree)?.length) return this.set(tree, leaf);
		else {
			const nodes = this.getNodes(tree);
			if (nodes.includes(`${leaf}`)) {
				const idx = nodes.indexOf(`${leaf}`);
				return nodes.splice(0, idx + 1).join('.');
			} else return `${tree}.${leaf}`;
		}
		return false;
	},
	getNodes: function (tree) {
		return tree?.split('.') || [];
	},
	getDivergence: function (oldtree, newtree) {
		const oNodes = this.getNodes(oldtree);
		const nNodes = this.getNodes(newtree);
		let divergentNodes = [];
		for (let i = 0; i < Math.max(oNodes.length, nNodes.length); i ++) {
			if (oNodes[i] !== nNodes[i]) {
				divergentNodes.push({ old: oNodes[i], new: nNodes[i], position: i });
			}
		}
		return divergentNodes;
	},
	moveUp: function (tree) {
		const depth = this.getDepth(tree);
		if (depth === 1) return this.getRoot(tree);
		else return this.getNodes(tree).slice(0, -1).join('.');
	},
	getRoot: function (tree) {
		return this.getNodes(tree)?.[0] || '0';
	},
	getDepth: function (tree) {
		return this.getNodes(tree)?.length;
	},
	getLeaf: function (tree) {
		const nodes = this.getNodes(tree);
		if (nodes?.length) return nodes[nodes.length - 1];
		else return undefined;
	},
	getChildren: function (pool, leaf) {
		return pool.filter(d => {
			return this.getLeaf(d.tree) === `${leaf}`;
		});
	},
	getSiblings: function (pool, tree, node) {
		return pool.filter(function (d) {
			return d.tree?.startsWith(tree) && node !== this;
		});
	},
	rebase: function (tree, node, newbase) {
		const nodes = this.getNodes(tree);
		const cut = nodes.indexOf(`${node}`);
		if (cut !== -1) {
			nodes.splice(0, cut);
			return `${newbase}.${nodes.join('.')}`;
		} else return `${newbase}.${node}`

	},
	build: function (base, node) {
		return `${base}.${node}`;
	},
	cutBranch: function (tree, node) {
		const nodes = this.getNodes(tree);
		const cut = nodes.indexOf(`${node}`);
		if (cut !== -1) {
			nodes.splice(cut, 1);
			return nodes.join('.');
		} else return tree;
	},
}