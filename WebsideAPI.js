import PowerlangObjectWrapper from "./PowerlangObjectWrapper.js";
import aPowerlangSpeciesWrapper from "./PowerlangSpeciesWrapper.js";

class WebsideAPI extends Object {
	constructor(server, request, response) {
		super();
		this.server = server;
		this.runtime = server.runtime;
		this.request = request;
		this.response = response;
	}

	notFound() {
		this.response.sendStatus(404);
	}

	badRequest(text) {
		this.response.status(400).send(text || "Bad Request");
	}

	respondWithData(data) {
		this.response.end(data);
	}

	respondWithJson(json) {
		this.respondWithData(JSON.stringify(json));
	}

	//General endpoints
	dialect() {
		this.respondWithData("PowerlangJS");
	}

	//Code endpoints..."
	classes() {
		let root = this.queryAt("root");
		if (root) root = this.classNamed(root);
		else root = this.defaultRootClass();
		if (this.queryAt("tree") === "true") {
			let depth = this.queryAt("depth");
			if (depth) depth = parseInt(depth);
			const json = this.classTreeFrom(root, depth);
			return this.respondWithJson([json]);
		}
		const foo = root.allSubclasses();
		const classes = [root].concat(root.allSubclasses());
		if (this.queryAt("names") === "true") {
			const names = classes.map((c) => c.name());
			return this.respondWithJson(names);
		}
		this.respondWithJson(classes.map((c) => c.asWebsideJson()));
	}

	classDefinition() {
		let species = this.requestedClass();
		if (!species) return this.notFound();
		this.respondWithJson(species.asWebsideJson());
	}

	classVariables() {
		let species = this.requestedClass();
		if (!species) return this.notFound();
		let variables = species.withAllSuperclasses().flatMap((c) =>
			c.classVarNames().map((v) => {
				return { name: v, class: c.name(), type: "class" };
			})
		);
		this.respondWithJson(variables);
	}

	instanceVariables() {
		let species = this.requestedClass();
		if (!species) return this.notFound();
		let variables = species.withAllSuperclasses().flatMap((c) => {
			c.instVarNames().map((v) => {
				return { name: v, class: c.name(), type: "instance" };
			});
		});
		this.respondWithJson(variables);
	}

	variables() {
		let species = this.requestedClass();
		if (!species) return this.notFound();
		let variables = species.withAllSuperclasses().flatMap((c) => {
			let instance = c.instVarNames().map((v) => {
				return { name: v, class: c.name(), type: "instance" };
			});
			let meta = c.classVarNames().map((v) => {
				return { name: v, class: c.name(), type: "class" };
			});
			return instance.concat(meta);
		});
		this.respondWithJson(variables);
	}

	subclasses() {
		let species = this.requestedClass(this.request);
		if (!species) return this.notFound();
		let subclasses = species.subclasses().map((c) => c.asWebsideJson());
		this.respondWithJson(subclasses);
	}

	categories() {
		let species = this.requestedClass();
		if (!species) return this.notFound();
		this.respondWithJson(species.categories());
	}

	usedCategories() {
		let species = this.requestedClass();
		if (!species) return this.notFound();
		this.respondWithJson([]);
	}

	methods() {
		let methods;
		let selector = this.queriedSelector();
		if (selector) methods = this.implementorsOf(selector);
		selector = this.queriedSending();
		if (selector) {
			let senders = this.sendersOf(selector);
			methods = methods ? methods.intersection(senders) : senders;
		}
		let global = this.queriedReferencingClass();
		if (global) {
			let references = this.referencesTo(global);
			methods = methods ? methods.intersection(references) : references;
		}
		let species = this.requestedClass();
		if (!species) species = this.queriedClass();
		if (species && methods)
			methods = methods.filter((m) => m.classBinding()._equal(species));
		if (!methods) {
			if (!species) species = this.defaultRootClass();
			methods = species.methods();
		}
		methods = this.filterByCategory(methods);
		methods = this.filterByVariable(methods);
		this.respondWithJson(methods.map((m) => m.asWebsideJson()));
	}

	usualCategories() {
		this.respondWithJson([]);
	}

	//Objects endpoints..."
	pinnedObjects() {
		let objects = Object.entries(this.server.pinnedObjects).map((e) => {
			let json = e[1].asWebsideJson();
			json.id = e[0].toString();
			return json;
		});
		this.respondWithJson(objects);
	}

	pinnedObject() {
		let id = this.requestedId();
		let object = this.objectWithId(id);
		if (!object) return this.notFound();
		if (object.objectClass().name() == "WebsideEvaluationError") {
			return this.evaluationError(object);
		}
		this.respondWithJson(object.asWebsideJson());
	}

	pinnedObjectSlots() {
		let id = this.requestedId();
		let object = this.objectWithId(id);
		if (!object) return this.notFound();
		let path = this.request.path.split("/");
		let index = path.indexOf("objects");
		for (let i = index + 2; i < path.length - 2; i++) {
			object = this.slotOf(path[i], object);
			if (!object) return this.notFound();
		}
		let last = path.pop();
		if (last == "instance-variables") {
			return this.respondWithJson(this.instanceVariablesOf(object));
		}
		if (last == "named-slots") {
			return this.respondWithJson(this.namedSlotsOf(object));
		}
		if (last == "indexed-slots") {
			return this.respondWithJson(this.indexedSlotsOf(object));
		}
		if (last == "custom-presentations") {
			return this.respondWithJson(this.customPresentationsOf(object));
		}
		object = this.slotOf(last, object);
		if (!object) return this.notFound();
		this.respondWithJson(object.asWebsideJson());
	}

	pinSampleObjects() {
		this.server.pinnedObjects[0] = this.wrap(this.runtime.nil());
		this.server.pinnedObjects[1] = this.wrap(this.runtime.true());
		this.server.pinnedObjects[2] = this.wrap(this.runtime.newInteger_(123));
		// this.server.pinnedObjects[3] = this.wrap(
		// 	this.runtime.newArray_([
		// 		// this.runtime.nil(),
		// 		// this.runtime.true(),
		// 		// this.runtime.newInteger_(123),
		// 	])
		// );
		let x = this.runtime.newInteger_(1);
		let y = this.runtime.newInteger_(2);
		let point = this.runtime.sendLocal_to_with_("@", x, [y]);
		this.server.pinnedObjects[4] = this.wrap(point);
		this.server.pinnedObjects[5] = this.classNamed("Point");
	}

	unpinObject() {
		let id = this.requestedId();
		if (!this.server.pinnedObjects.hasOwnProperty(id))
			return this.notFound();
		delete this.server.pinnedObjects[id];
		this.respondWithData(id);
	}

	pinObjectSlot() {
		let slot = this.requestedSlot();
		if (!slot) return this.badRequest("Bad object slot URI");
		// Replace with UUID or the like...
		let id = (Object.keys(this.server.pinnedObjects).length + 1).toString();
		this.server.pinnedObjects[id] = slot;
		let json = slot.asWebsideJson();
		json["id"] = id;
		this.respondWithJson(json);
	}

	//Private...
	wrap(object) {
		return PowerlangObjectWrapper.on_runtime_(object, this.runtime);
	}

	defaultRootClass() {
		const nil = this.runtime.nil();
		let root = this.wrap(this.runtime.nil()).objectClass();
		while (!(root.superclass().wrappee() === this.runtime.nil()))
			root = root.superclass();
		return root;
	}

	classTreeFrom(species, depth) {
		const names = this.queryAt("names");
		var json;
		if (names === "true") {
			var superclass = species.superclass();
			json = {
				name: species.name(),
				superclass:
					superclass === this.runtime.nil()
						? superclass
						: superclass.name,
			};
		} else {
			json = species.asWebsideJson();
		}
		if (depth && depth == 0) return json;
		//const sorted = species.subclasses().sort( (a, b) => a.name < b.name);
		const subclasses = species
			.subclasses()
			.map((s) => this.classTreeFrom(s, depth - 1));
		json["subclasses"] = subclasses;
		return json;
	}

	classNamed(name) {
		if (!name) return null;
		let identifier = name;
		let metaclass = name.endsWith(" class");
		if (metaclass) identifier = identifier.slice(0, -" class".length);
		let root = this.defaultRootClass();
		let species = root
			.withAllSubclasses()
			.detect_((c) => c.name() == identifier);
		if (!species) return null;
		return metaclass ? species.metaclass() : species;
	}

	filterByCategory(methods) {
		let category = this.queriedCategory();
		return category
			? methods.filter((m) => m.category() == category)
			: methods;
	}

	filterByVariable(methods) {
		let variable = this.queriedAccessing();
		if (!variable) return methods;
		return methods.filter((m) => {
			let slot = undefined;
			let classVar = undefined;
			let species = m.methodClass();
			if (species.hasSlotNamed(variable))
				slot = species.slotNamed(variable);
			if (species.classVarNames().includes_(variable))
				classVar = species.classVarNamed(variable);
			return (
				(slot && (slot.isReadIn(m) || slot.isWrittenIn(m))) ||
				(classVar && classVar.isReferencedIn(m))
			);
		});
	}

	implementorsOf(symbol) {
		let scope = this.queriedScope();
		if (scope) {
			debugger;
			return scope.implementorsOf(symbol);
		}
		let root = this.defaultRootClass();
		return root
			.withAllSubspecies()
			.filter((c) => c.includesSelector_(symbol))
			.map((c) => c.methodFor_(symbol));
	}

	queriedAccessing() {
		return this.parameterAt("accessing") || this.queryAt("accessing");
	}

	queriedCategory() {
		return this.parameterAt("category") || this.queryAt("category");
	}

	queriedClass() {
		let name = this.parameterAt("class") || this.queryAt("class");
		return typeof name == "function" ? undefined : name;
	}

	queriedReferencingClass() {
		return (
			this.parameterAt("referencingClass") ||
			this.queryAt("referencingClass")
		);
	}

	queriedReferencingString() {
		return (
			this.parameterAt("referencingString") ||
			this.queryAt("referencingString")
		);
	}

	queriedScope() {
		let scope = this.parameterAt("scope") || this.queryAt("scope");
		return this.classNamed(scope);
	}

	queriedSelector() {
		return this.parameterAt("selector") || this.queryAt("selector");
	}

	queriedSending() {
		return this.parameterAt("sending");
	}

	requestedClass() {
		const name = this.parameterAt("classname") || this.queryAt("classname");
		return this.classNamed(name);
	}

	requestedId() {
		let id = this.parameterAt("id");
		return id;
	}

	objectWithId(id) {
		let evaluation = this.server.evaluations[id];
		if (evaluation) {
			//evaluation.waitForResult
		}
		return this.server.pinnedObjects[id];
	}

	queryAt(option) {
		return this.request.query[option];
	}

	parameterAt(name) {
		return this.request.params[name];
	}

	bodyAt(name) {
		return this.request.body[name];
	}

	requestedSlot() {
		let uri = this.bodyAt("uri");
		if (!uri) return null;
		let index = uri.indexOf("/objects/") + 9;
		let path = uri.substring(index, uri.length);
		return this.objectFromPath(path);
	}

	objectFromPath(path) {
		let segments = path.split("/");
		let id = segments[0];
		let slot = this.server.pinnedObjects[id];
		if (!slot) return null;
		for (let i = 1; i < segments.length; i++) {
			slot = this.slotOf(segments[i], slot);
			if (!slot) return null;
		}
		return slot;
	}

	instanceVariablesOf(object) {
		return object
			.objectClass()
			.allInstVarNames()
			.map((v) => {
				return { name: v };
			});
	}

	namedSlotsOf(object) {
		return object
			.objectClass()
			.allInstVarNames()
			.map((v) => {
				let slot = this.slotOf(v, object);
				let json = slot.asWebsideJson();
				json["slot"] = v;
				return json;
			});
	}

	indexedSlotsOf(object) {
		if (!object.hasIndexedSlots().asLocalObject()) {
			return this.notFound();
		}
		let from = this.queryAt("from");
		from = from ? parseInt(from) : 1;
		let to = this.queryAt("to");
		to = to ? parseInt(to) : object.size().asLocalObject();
		let slots = [];
		for (let i = from; i <= from; i++) {
			let slot = object.slotAt_(i).asWebsideJson();
			slot["slot"] = i;
			slots.push(slot);
		}
		return slots;
	}

	customPresentationsOf(object) {
		return [];
	}

	slotOf(slot, object) {
		if (parseInt(slot).toString() == slot) {
			let index = parseInt(slot);
			if (object.objectClass().instancesAreArrayed().asLocalObject()) {
				return index <= object.size().asLocalObject()
					? object.at_(index)
					: null;
			}
		}
		let index = object.objectClass().allInstVarNames().indexOf(slot);
		return index != -1 ? object.slotAt_(index + 1) : null;
	}
}

export default WebsideAPI;
