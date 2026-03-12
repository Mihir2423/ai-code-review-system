interface ResponseData {
    success: boolean;
    content: unknown;
    message: string;
}

class SuccessResponse {
    success: boolean;
    content: unknown;
    message: string;

    constructor({ content, message = '' }: { content: unknown; message?: string }) {
        this.success = true;
        this.content = content;
        this.message = message;
    }

    static Builder = class {
        content: unknown;
        message: string;

        constructor() {
            this.content = null;
            this.message = '';
        }

        withContent(content: unknown) {
            this.content = content;
            return this;
        }

        withMessage(message: string) {
            this.message = message;
            return this;
        }

        build(): SuccessResponse {
            if (this.content === null) {
                throw new Error('Content must be provided for SuccessResponse');
            }
            return new SuccessResponse({ content: this.content, message: this.message });
        }
    };
}

class FailResponse {
    success: boolean;
    content: unknown;
    message: string;

    constructor({ content, message = '' }: { content: unknown; message?: string }) {
        this.success = false;
        this.content = content;
        this.message = message;
    }

    static Builder = class {
        content: unknown;
        message: string;

        constructor() {
            this.content = null;
            this.message = '';
        }

        withContent(content: unknown) {
            this.content = content;
            return this;
        }

        withMessage(message: string) {
            this.message = message;
            return this;
        }

        build(): FailResponse {
            if (this.content === null) {
                throw new Error('Content must be provided for FailResponse');
            }
            return new FailResponse({ content: this.content, message: this.message });
        }
    };
}

export { SuccessResponse, FailResponse };
