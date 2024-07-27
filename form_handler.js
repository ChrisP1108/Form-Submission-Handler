export default class FormHandler {

    #formNode;
    #fieldNodes = [];
    #formData = {};
    #changeSubscribers = [];
    #onSubmitFinishSubscribers = [];
    #onSubmitInitSubscribers = [];
    #submitUrl;
    #submissionResponse;
    #submitContentType = 'application/json';
    #clearFieldsOnSuccess = true;
    #responseSuccessMsg;
    #customHeaders = {};

    constructor(formNode = null, submitUrl = null, responseSuccessMsg) {
        this.#formNode = formNode ? document.querySelector(formNode) : null;
        this.#submitUrl = submitUrl;
        this.#responseSuccessMsg = typeof responseSuccessMsg === 'string' ? responseSuccessMsg : null;

        if (this.#formNode) {
            this.#selectAllFormInputNodes();
        }
    }

    #selectAllFormInputNodes() {
        if (!this.#formNode) return;

        this.#fieldNodes = [
            ...this.#formNode.querySelectorAll("input"),
            ...this.#formNode.querySelectorAll("select"),
            ...this.#formNode.querySelectorAll("textarea")
        ];

        this.#setEventListeners();
    }

    clearFields() {
        this.#fieldNodes.forEach(node => {
            if (node.type === 'radio' || node.type === 'checkbox') {
                node.checked = false;
            } else {
                node.value = '';
            }
        });
        this.#formData = {};
    }

    #setEventListeners() {
        this.#fieldNodes.forEach(node => {
            const listenerType = this.#getListenerType(node);
            if (listenerType) {
                node.addEventListener(listenerType, this.#debounce(() => this.#updateFormData(node), 300));
            }
        });

        this.#formNode.addEventListener("submit", async e => {
            e.preventDefault();
            this.#onSubmitInitSubscribers.forEach(subscriber => subscriber(this.#formData));
            if (this.validateFormData()) {
                const formSubmit = await this.#submitForm();
                this.#handleFormSubmitResponse(formSubmit);
            } else {
                console.error("Form validation failed.");
            }
        });
    }

    #getListenerType(node) {
        switch (node.nodeName) {
            case 'INPUT':
                return node.type === 'radio' || node.type === 'checkbox' ? 'change' : 'input';
            case 'SELECT':
                return 'change';
            case 'TEXTAREA':
                return 'input';
            default:
                return null;
        }
    }

    #updateFormData(node) {
        if (node.type === 'radio' || node.type === 'checkbox') {
            if (node.checked) {
                this.#formData[node.name] = node.value;
            } else if (node.type === 'checkbox' && !node.checked) {
                delete this.#formData[node.name];
            }
        } else {
            this.#formData[node.name] = node.value;
        }
        this.#changeSubscribers.forEach(subscriber => subscriber(this.#formData));
    }

    #debounce(func, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    }

    validateFormData() {
        // Add form validation logic here
        // Return true if valid, false otherwise
        return true;
    }

    #handleFormSubmitResponse(formSubmit) {
        const outputMsgNode = document.createElement("p");
        outputMsgNode.setAttribute("role", "alert");
        outputMsgNode.classList.add("form-submission-result-msg");
        if (!formSubmit.ok) {
            outputMsgNode.classList.add("form-submission-err-msg");
        }
        if (formSubmit.ok && this.#clearFieldsOnSuccess) {
            this.clearFields();
            outputMsgNode.classList.add("form-submission-success");
        }
        outputMsgNode.innerHTML = formSubmit.outputMsg;
        if (this.#responseSuccessMsg) {
            const existingMsgNode = this.#formNode.querySelector("p.form-submission-result-msg");
            if (existingMsgNode) existingMsgNode.remove();
            this.#formNode.appendChild(outputMsgNode);
            this.onChange(() => {
                const resultMsgNode = this.#formNode.querySelector("p.form-submission-result-msg");
                if (resultMsgNode) resultMsgNode.remove();
            });
        }
        this.#submissionResponse = formSubmit;
        this.#onSubmitFinishSubscribers.forEach(subscriber => subscriber(this.#formData));
    }

    get data() {
        return this.#formData;
    }

    get JSON() {
        return JSON.stringify(this.#formData);
    }

    get submitUrl() {
        return this.#submitUrl;
    }

    get formNode() {
        return this.#formNode;
    }

    get submissionResponse() {
        return this.#submissionResponse;
    }

    set submitUrl(url) {
        if (typeof url === 'string') {
            this.#submitUrl = url;
        } else {
            console.error("submitUrl must be a string");
        }
    }

    set contentType(type) {
        this.#submitContentType = type;
    }

    set responseSuccessMsg(input) {
        if (typeof input === 'string') {
            this.#responseSuccessMsg = input;
        }
    }

    set formNode(formNode) {
        this.#formNode = formNode ? document.querySelector(formNode) : null;
        if (this.#formNode) {
            this.#selectAllFormInputNodes();
        } else {
            console.error("formNode input value returned null.");
        }
    }

    set clearFieldsOnSuccess(value) {
        if (typeof value === 'boolean') {
            this.#clearFieldsOnSuccess = value;
        }
    }

    set customHeaders(headers) {
        if (typeof headers === 'object' && !Array.isArray(headers)) {
            this.#customHeaders = headers;
        } else {
            console.error("customHeaders must be an object");
        }
    }

    onChange(callback) {
        if (typeof callback === 'function') {
            this.#changeSubscribers.push(callback);
        } else {
            console.error("onChange parameter needs to be a function.");
        }
    }

    onSubmitInit(callback) {
        if (typeof callback === 'function') {
            this.#onSubmitInitSubscribers.push(callback);
        } else {
            console.error("onSubmitInit parameter needs to be a function.");
        }
    }

    onSubmitFinish(callback) {
        if (typeof callback === 'function') {
            this.#onSubmitFinishSubscribers.push(callback);
        } else {
            console.error("onSubmitFinish parameter needs to be a function.");
        }
    }

    async #submitForm() {
        if (!this.#submitUrl) {
            const noSubmitUrlMsg = "A URL to send the form to via an HTTP POST request must be set using the submitUrl set property.";
            console.error(noSubmitUrlMsg);
            return { ok: false, status: null, msg: noSubmitUrlMsg, outputMsg: noSubmitUrlMsg };
        }
    
        const outputErrMsg = "There was an error submitting the form data.";
    
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve({ ok: false, status: null, msg: "Timed out.", outputMsg: "Took too long to get a response from the server. Please try again." });
            }, 10000);
        });
    
        const fetchPromise = fetch(this.#submitUrl, {
            method: 'POST',
            headers: {
                'Content-Type': this.#submitContentType,
                ...this.#customHeaders
            },
            body: this.JSON
        }).then(async (res) => {
            if (res.ok) {
                return { ok: res.ok, status: res.status, data: await res.json(), outputMsg: this.#responseSuccessMsg };
            } else {
                console.error(`Server responded with a ${res.status} status code`);
                return { ok: false, status: res.status, msg: `Server responded with a ${res.status} status code`, outputMsg: outputErrMsg };
            }
        }).catch((err) => {
            console.error(err);
            return { ok: false, status: null, msg: err.toString(), outputMsg: outputErrMsg };
        });
    
        return Promise.race([timeoutPromise, fetchPromise]);
    }
}