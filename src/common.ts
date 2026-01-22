/*
this file exports common general types used throughout the project.
*/

export class Err<Kind> {
	constructor(type: Kind, message: string) {
		this.type = type;
		this.message = message;
	}

	readonly type: Kind;
	readonly message: string;

	toError(): Error {
		return new Error(this.toString());
	}

	toString() {
		return `error (${this.type}) ${this.message}`;
	}
}

