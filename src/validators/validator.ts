import validator from 'validator';
import { model } from "mongoose";
import { TLang } from "@resources/i18n/interface";
import { IErrorValidator, IObj, IObjValidate } from "./interface";
import { i18nValidator } from '@config/i18n.config';
import { fieldToKey } from '@helpers/validator.helper';
import _ from 'lodash'

export default class Validator {
    private obj: IObj
    errors: IErrorValidator
    private lang: TLang
    private user?: IObj

    constructor(obj: IObj, lang: any, user?: IObj) {
        this.obj = obj;
        this.errors = {}
        this.lang = lang
        this.user = user
    }

    async validate(objValidate: IObjValidate[]) {
        await Promise.all(
            objValidate.map(async item => {
                await Promise.all(
                    item.rules.map(async rule => {
                        let ruleParams = '', ruleName = '';
                        if (rule.indexOf(":") >= 0) {
                            ruleParams = rule.split(":")[1];
                            ruleName = rule.split(":")[0]
                        }
                        else {
                            ruleName = rule
                        }

                        const value = _.get(this.obj, item.field)

                        if ((rule != 'required' && !!value) || rule == 'optional') {
                            let rules = new Rules({
                                key: fieldToKey(item.field),
                                value: value,
                                params: ruleParams,
                                lang: this.lang,
                                user: this.user
                            })
                            await rules.check(ruleName)
                            let { error, message } = rules.result()
                            if (error) {
                                this.addError(item.field as any, message)
                            }
                        }
                        else {
                            let rules = new Rules({
                                key: fieldToKey(item.field),
                                value: value,
                                params: ruleParams,
                                lang: this.lang,
                                user: this.user
                            })
                            await rules.check('required')
                            let { error, message } = rules.result()
                            if (error) {
                                this.addError(fieldToKey(item.field), message)
                            }
                        }
                    })
                )
            })
        )
    }

    private addError(field: string, message: string) {
        if (Object.keys(this.errors).indexOf(field) < 0) {
            this.errors[field] = []
        }
        this.errors[field].push(message.replace(":field", i18nValidator.fieldname.__({ phrase: field, locale: this.lang })))
        let messages = this.errors[field];
        let messagesSet = new Set(messages)
        this.errors[field] = Array.from(messagesSet)
    }

    hasError() {
        return Object.keys(this.errors).length > 0
    }

    private capitalizeFirstLetter(text: string) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
}



class Rules {
    error: boolean;
    message: string;
    key: string;
    value: string;
    params: string;
    lang: TLang;
    user?: IObj;

    constructor(data: {
        key: string,
        value: string,
        params: string,
        lang: TLang,
        user?: IObj
    }) {
        this.error = false;
        this.message = ''
        this.key = data.key;
        this.value = data.value;
        this.params = data.params;
        this.lang = data.lang;
        this.user = data.user;
    }

    async check(ruleName: string) {
        switch (ruleName) {
            case 'required':
                await this.required()
                break;
            case 'isNumeric':
                await this.isNumeric()
                break;
            case 'isEmail':
                await this.isEmail()
                break;
            case 'only':
                await this.only()
                break;
            case 'optional':
                await this.optional()
                break;
            case 'unique':
                await this.unique()
                break;
            case 'link':
                await this.link()
                break;
        }
    }

    /**
     * field: 'email'
     * rules: ['required']
     */
    private async required() {
        if (!this.value) {
            this.error = true;
            this.message = `:field ${i18nValidator.message.__({ phrase: 'is_required', locale: this.lang })}`
        }
    }

    /**
     * field: 'email'
     * rules: ['unique:User,email'] or ['unique:User,email,id'] (ignore id)
     */
    private async unique() {
        let paramsList = this.params.split(",")
        let tableName = paramsList[0];
        let fieldCol = paramsList[1];
        let ignoreField = paramsList[2];

        let item: any = await model(tableName).findOne({ [fieldCol]: this.value })
        if (!!item) {
            let ignoreValue = item[ignoreField]
            if (ignoreField == '_id') ignoreValue = item[ignoreField].toString()

            if (ignoreField && this.user?.[ignoreField] != ignoreValue) {
                this.error = true;
                this.message = `:field ${i18nValidator.message.__({ phrase: 'is_exists', locale: this.lang })}`
            }
            else if (!ignoreField) {
                this.error = true;
                this.message = `:field ${i18nValidator.message.__({ phrase: 'is_exists', locale: this.lang })}`
            }

        }
    }

    /**
     * field: 'email'
     * rules: ['isNumeric']
     */
    private async isNumeric() {
        if (!validator.isNumeric(this.value)) {
            this.error = true
            this.message = `:field ${i18nValidator.message.__({ phrase: 'is_not_numberic', locale: this.lang })}`
        }
    }

    /**
     * field: 'email'
     * rules: ['isEmail']
     */
    private async isEmail() {
        if (!validator.isEmail(this.value)) {
            this.error = true
            this.message = `:field ${i18nValidator.message.__({ phrase: 'is_not_email_format', locale: this.lang })}`
        }

    }

    /**
     * field: 'email'
     * rules: ['only']
     */
    private async only() {
        let onlyValues: string[] = this.params.split(",");

        if (onlyValues.indexOf(this.value) < 0) {
            return {
                error: true,
                msg: `:field ${i18nValidator.message.__({ phrase: 'is_not_exist', locale: this.lang })}`
            }
        }
        else return {
            error: false,
            msg: ""
        }
    }

    /**
     * field: 'email'
     * rules: ['optional']
     */
    private async optional() {
        if (this.value == undefined) {
            this.error = true
            this.message = `:field ${i18nValidator.message.__({ phrase: 'is_undefined', locale: this.lang })}`
        }
    }

    /**
    * field: 'link'
    * rules: ['link']
    */
    private async link() {
        if (!validator.isURL(this.value)) {
            this.error = true
            this.message = `:field ${i18nValidator.message.__({ phrase: 'is_not_formatted', locale: this.lang })}`
        }
    }

    result() {
        return {
            error: this.error,
            message: this.message
        }
    }
}