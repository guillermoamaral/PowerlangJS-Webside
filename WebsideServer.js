import express from "express";
import cors from "cors";
import PowerlangObjectWrapper from "./PowerlangObjectWrapper.js";
import aPowerlangSpeciesWrapper from "./PowerlangSpeciesWrapper.js"

class WebsideServer extends Object {
	constructor(host, port, runtime) {
		super();
		this.runtime = runtime;
		this.host = host;
		this.port = port;
		this.server = express();
		this.server.use(cors());
		this.initializeEndpoints();
	}

	start() {
		this.server.listen(this.port, this.host, () => {
			console.log(
				`WebsideServer is running on http://${this.host}:${this.port}`
			);
		});
	}

	answer(response, data) {
		response.end(JSON.stringify(data));
	}

	initializeEndpoints() {
		this.server.get("/dialect", (request, response) => {
			response.end("PowerlangJS");
		});

		this.server.get("/classes", (request, response) => {
			let root = request.query["root"];
			if (root)
				root = this.classNamed(root);
			else
				root = this.defaultRootClass();

			if (request.query["tree"] === "true")
			{
				let depth = request.query["depth"];
				if (depth)
					depth = parseInt(depth);
				const json = this.classTreeFrom_depth_(request, root, depth);
				return this.answer(response, [json]);
			}
			const foo = root.allSubclasses();
			const classes = [root].concat(root.allSubclasses());
			if (request.query["names"] === "true") {
				const names = classes.map( (klass) => klass.name() );
				return this.answer(response, names);
			}
			this.answer(response, classes.map( (c) => c.asWebsideJson() ))
		});

		this.server.get("/classes/:classname", (request, response) => {
			return this.answer(response, this.classDefinition(request));
		});

		this.server.get("/classes/:classname/variables", (request, response) => {
			let klass = this.requestedClass(request);
			if (!klass) { return this.notFound(response)}
			return this.answer(response, this.instanceVariables(request).concat(this.classVariables(request)));
		});

		this.server.get("/classes/:classname/subclasses", (request, response) => {
			let klass = this.requestedClass(request);
			if (!klass) { return this.notFound(response)}
			return this.answer(response, klass.subclasses().map(c => c.asWebsideJson()));
		});

		this.server.get("/classes/:classname/categories", (request, response) => {
			let klass = this.requestedClass(request);
			if (!klass) { return this.notFound(response)}
			return this.answer(response, klass.categories());
		});

		this.server.get("/classes/:classname/used-categories", (request, response) => {
			let klass = this.requestedClass(request);
			if (!klass) { return this.notFound(response)}
			return this.answer(response, []);
		});

		this.server.get("/classes/:classname/methods", (request, response) => {
			let methods = undefined;
			let selector = this.queriedSelector(request);
			if (selector) 
				methods = this.implementorsOf(request, selector);
			
			selector = this.queriedSending(request);
			if (selector) { 
				let senders = this.sendersOf(selector);
				methods = methods ? methods.intersection(senders) : senders;
			}

			let global = this.queriedReferencingClass(request);
			if (global) {
				let references = this.referencesTo(global);
				methods = methods ? methods.intersection(references) : references;
			}

			let klass = this.requestedClass(request);
			if (!klass)
				klass = this.queriedClass(request);

			if (klass && methods) 
				methods = methods.filter(m => m.classBinding()._equal(klass));

			if (!methods) {
				if (!klass)
					klass = this.defaultRootClass();
				methods = klass.methods();
			}
			methods = this.filterByCategory(request, methods);
			methods = this.filterByVariable(request, methods);

			return this.answer(response, methods.map(m => m.asWebsideJson()));
		});

		this.server.get("/usual-categories", (request, response) => {
			
			return this.answer(response, []);
		});

	}

	defaultRootClass() {
		const nil = this.runtime.nil();
		let root = PowerlangObjectWrapper.on_runtime_(this.runtime.nil(), this.runtime).objectClass();
		while (!(root.superclass().wrappee() === this.runtime.nil()))
			root = root.superclass();
		return root;
	}

	classDefinition(request) {

		let klass = this.requestedClass(request);
		if (!klass) return this.notFound(request);
		return klass.asWebsideJson();
	}

	classTreeFrom_depth_(request, aPowerlangSpeciesWrapper, depth) {

		const names = request.query["names"];
		var json;
		if (names === 'true')
		{
			var superclass = aPowerlangSpeciesWrapper.superclass();
			json = {
				'name': aPowerlangSpeciesWrapper.name(),
				'superclass' : (superclass === this.runtime.nil() ? superclass : superclass.name)
			};
		}
		else {
			json = aPowerlangSpeciesWrapper.asWebsideJson();
		}

		if (depth && depth == 0) return json;

		//const sorted = aPowerlangSpeciesWrapper.subclasses().sort( (a, b) => a.name < b.name);
		const subclasses = aPowerlangSpeciesWrapper.subclasses().map( (species) => this.classTreeFrom_depth_(request, species, depth - 1) );
		json['subclasses'] = subclasses;
		return json;
	}

	classNamed(aString) {
		let name = aString;
		let metaclass = name.endsWith(' class');
		if (metaclass)
			name = name.slice(0,-(' class'.length));
		let root = this.defaultRootClass();
		let klass = root.withAllSubclasses().detect_( (c) => c.name() == name );
		if (!klass) return null;

		return metaclass? klass.metaclass() : klass;
	}

	classVariables(request) {
		let klass = this.requestedClass(request);
		return klass.withAllSuperclasses().flatMap( c => c.classVarNames().map( v => { return {'name': v, 'class': c.name(), 'type': 'instance'} }) );
	}

	instanceVariables(request) {
		let klass = this.requestedClass(request);
		return klass.withAllSuperclasses().flatMap( c => c.instVarNames().map( v => { return {'name': v, 'class': c.name(), 'type': 'instance'} }) );
	}

	filterByCategory(request, aCollection) {
		let category = this.queriedCategory(request);
		return category ? aCollection.filter(m => m.category() == category) : aCollection;
	}

	filterByVariable(request, aCollection) {
		let variable = this.queriedAccessing(request);
	
		if (!variable) return aCollection;
		return aCollection.filter( m => { 
			let slot = undefined;
			let classVar = undefined;
			let klass = m.methodClass();
			if (klass.hasSlotNamed(variable)) 
				slot = klass.slotNamed(variable);
			if (klass.classVarNames().includes_(variable))
				classVar = klass.classVarNamed(variable);
			return ((slot && (slot.isReadIn(m) || slot.isWrittenIn(m))) || 
				(classVar && classVar.isReferencedIn(m)));
		});
	}

	implementorsOf(request, aSymbol) {

		let scope = this.queriedScope(request);
		if (scope) {
			debugger;
			return scope.implementorsOf(request, aSymbol);
		}
		let root = this.defaultRootClass();
		return root.withAllSubclasses().filter( c => c.includesSelector(aSymbol)).map( c => c.send(">>", [aSymbol]) );
	}

	queriedAccessing(request) {
		return request.params.accessing;
	}

	queriedCategory(request) {
		return request.params.category;
	}

	queriedClass(request) {
		let k = request.params["class"]
		return (typeof k) == "function" ? undefined : k;
	}

	queriedReferencingClass(request) {
		return request.params.referencingClass;
	}

	queriedReferencingString(request) {
		return request.params.referencingString;
	}


	queriedSelector(request) {
		return request.params.selector;
	}

	queriedSending(request) {
		return request.params.sending;
	}

	requestedClass(request) {
		const classname = request.params.classname;
		return classname? this.classNamed(classname) : undefined;
	}
}

export default WebsideServer;
