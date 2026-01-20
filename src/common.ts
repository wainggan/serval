
export class Err<Type> {
	constructor(type: Type, message: string) {
		this.type = type;
		this.message = message;
	}

	readonly type: Type;
	readonly message: string;

	toError(): Error {
		return new Error(this.toString());
	}

	toString() {
		return `error (${this.type}) ${this.message}`;
	}
}

