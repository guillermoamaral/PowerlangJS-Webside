import express from "express";
import cors from "cors";
import PowerlangObjectWrapper from "./PowerlangObjectWrapper.js";
import aPowerlangSpeciesWrapper from "./PowerlangSpeciesWrapper.js";
import WebsideAPI from "./WebsideAPI.js";

class WebsideServer extends Object {
	constructor(host, port, runtime) {
		super();
		this.runtime = runtime;
		this.host = host;
		this.port = port;
		this.server = express();
		this.server.use(cors());
		this.initializeEndpoints();
		this.pinnedObjects = {};
		this.evaluations = {};

		// until we fix serialization of closures saved in kernel (their code is broken)
		let api = new WebsideAPI(this);
		api.classNamed("Symbol").symbolTable().policy().useStringHash();
		api.pinSampleObjects();
	}

	start() {
		this.server.listen(this.port, this.host, () => {
			console.log(
				`WebsideServer is running on http://${this.host}:${this.port}`
			);
		});
	}

	api(request, response) {
		return new WebsideAPI(this, request, response);
	}

	initializeEndpoints() {
		this.server.get("/dialect", (request, response) => {
			this.api(request, response).dialect();
		});

		//Code endpoints..."
		this.server.get("/classes", (request, response) => {
			this.api(request, response).classes();
		});

		this.server.get("/classes/:classname", (request, response) => {
			this.api(request, response).classDefinition();
		});

		this.server.get(
			"/classes/:classname/variables",
			(request, response) => {
				this.api(request, response).variables();
			}
		);

		this.server.get(
			"/classes/:classname/subclasses",
			(request, response) => {
				this.api(request, response).subclasses();
			}
		);

		this.server.get(
			"/classes/:classname/categories",
			(request, response) => {
				this.api(request, response).categories();
			}
		);

		this.server.get(
			"/classes/:classname/used-categories",
			(request, response) => {
				this.api(request, response).usedCategories();
			}
		);

		this.server.get("/classes/:classname/methods", (request, response) => {
			this.api(request, response).methods();
		});

		this.server.get("/methods", (request, response) => {
			this.api(request, response).methods();
		});

		this.server.get("/usual-categories", (request, response) => {
			this.api(request, response).usualCategories();
		});

		//Objects endpoints..."
		this.server.get("/objects", (request, response) => {
			this.api(request, response).pinnedObjects();
		});

		this.server.get("/objects/:id/*", (request, response) => {
			this.api(request, response).pinnedObjectSlots();
		});

		this.server.get("/objects/:id", (request, response) => {
			this.api(request, response).pinnedObject();
		});

		this.server.delete("/objects/:id", (request, response) => {
			this.api(request, response).unpinObject();
		});
	}
}

export default WebsideServer;
