import PowerlangObjectWrapper from './PowerlangObjectWrapper.js';

let PowerlangMethodWrapper = class extends PowerlangObjectWrapper {
	asWebsideJson() {
		let res = super.asWebsideJson();
		res["selector"] = this.selector();
		res["methodClass"] = this.classBinding().name();
		res["category"] = "self category";
		res["source"] = this.sourceCode();
		res["author"] = "self author";
		res["timestamp"] = "self timeStamp";
		res["overriding"] = false;
		res["overriden"] = false;
		return res;
	}

	selector() {
		let s = this.send("selector");
		if (s) return s.wrappee().asLocalString();
		return nil;
	}

	sourceCode() {
		let source;
		source = this.sourceObject().wrappee();
		if (source === this._runtime.nil()) 
			return "no source"
		else
			return source.asLocalString();
	}

}

export default PowerlangMethodWrapper
