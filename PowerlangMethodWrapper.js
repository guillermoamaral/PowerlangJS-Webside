import PowerlangObjectWrapper from "./PowerlangObjectWrapper.js";

let PowerlangMethodWrapper = class extends PowerlangObjectWrapper {
	asWebsideJson() {
		let json = super.asWebsideJson();
		json["selector"] = this.selector();
		json["methodClass"] = this.classBinding().name();
		json["category"] = "self category";
		json["source"] = this.sourceCode();
		json["author"] = "self author";
		json["timestamp"] = "self timeStamp";
		json["overriding"] = false;
		json["overriden"] = false;
		return json;
	}

	selector() {
		let s = this.send("selector");
		if (s) return s.wrappee().asLocalString();
		return nil;
	}

	sourceCode() {
		let source;
		source = this.sourceObject().wrappee();
		if (source === this._runtime.nil()) return "no source";
		else return source.asLocalString();
	}
};

export default PowerlangMethodWrapper;
