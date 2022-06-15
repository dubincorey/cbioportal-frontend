import { CancerTreeNodeFields } from 'shared/lib/query/textQueryUtils';
import _ from 'lodash';
import { CancerTreeNode } from 'shared/components/query/CancerStudyTreeData';

export const FILTER_SEPARATOR = `:`;
export const FILTER_VALUE_SEPARATOR = ',';
export const NOT_PREFIX = `-`;

export interface ISearchClause {
    isNot(): boolean;
    isAnd(): boolean;
    toString(): string;
    equals(other: ISearchClause): boolean;

    /**
     * check clause contains phrase using:
     * - {@link Phrase}
     * - or a predicate function
     */
    contains(match: Phrase | null | ((predicate: Phrase) => boolean)): boolean;

    /**
     * @returns {phrases}
     *
     *  - not-clause returns one phrase
     *  - and-clause returns one or more phrases
     */
    getPhrases(): Phrase[];
}

/**
 * Negative clause
 * contains single phrase
 */
export class NotSearchClause implements ISearchClause {
    private readonly phrase: Phrase;
    private readonly type = 'not';

    constructor(phrase: Phrase) {
        this.phrase = phrase;
    }

    getPhrases(): Phrase[] {
        return [this.phrase];
    }

    isAnd(): boolean {
        return false;
    }

    isNot(): boolean {
        return true;
    }

    toString(): string {
        return this.phrase ? `${NOT_PREFIX} ${this.phrase.toString()}` : '';
    }

    equals(other: ISearchClause): boolean {
        if (other.isAnd()) {
            return false;
        }
        return other.contains(this.phrase);
    }

    contains(match: Phrase | null | ((predicate: Phrase) => boolean)): boolean {
        if (!match) {
            return !this.phrase;
        }
        if (_.isFunction(match)) {
            return match(this.phrase);
        }
        return this.phrase.equals(match);
    }
}

/**
 * Conjunctive clause
 * consists of multiple phrases which all must match
 */
export class AndSearchClause implements ISearchClause {
    private readonly phrases: Phrase[];
    private readonly type = 'and';

    constructor(phrases: Phrase[]) {
        this.phrases = phrases;
    }

    getPhrases(): Phrase[] {
        return this.phrases;
    }

    isAnd(): boolean {
        return true;
    }

    isNot(): boolean {
        return false;
    }

    toString(): string {
        return this.phrases.length
            ? this.phrases.map(p => p.toString()).join(' ')
            : '';
    }

    contains(match: Phrase | null | ((predicate: Phrase) => boolean)): boolean {
        if (!match) {
            return !this.phrases.length;
        }
        if (_.isFunction(match)) {
            for (const phrase of this.phrases) {
                if (match(phrase)) {
                    return true;
                }
            }
            return false;
        }

        for (const phrase of this.phrases) {
            if (phrase.equals(match)) {
                return true;
            }
        }
        return false;
    }

    equals(other: ISearchClause): boolean {
        if (other.isNot()) {
            return false;
        }
        let itemPhrases = (other as AndSearchClause).phrases;
        let containsAll = true;
        for (const itemPhrase of this.phrases) {
            containsAll = containsAll && other.contains(itemPhrase);
        }
        for (const itemPhrase of itemPhrases) {
            containsAll = containsAll && this.contains(itemPhrase);
        }
        return containsAll;
    }
}

/**
 * Phrase string and associated fields
 */
export interface Phrase {
    phrase: string;
    toString(): string;

    /**
     * Does filter match study?
     */
    match(study: CancerTreeNode): boolean;

    /**
     * Are two phrases equal?
     */
    equals(other: Phrase): boolean;
}

export class DefaultPhrase implements Phrase {
    constructor(
        phrase: string,
        textRepresentation: string,
        fields: CancerTreeNodeFields[]
    ) {
        this._fields = fields;
        this._phrase = phrase;
        this._textRepresentation = textRepresentation;
    }

    private readonly _fields: CancerTreeNodeFields[];
    protected readonly _textRepresentation: string;
    private readonly _phrase: string;

    public get phrase() {
        return this._phrase;
    }

    public get fields() {
        return this._fields;
    }

    public toString() {
        return this._textRepresentation;
    }

    public match(study: CancerTreeNode): boolean {
        let anyFieldMatch = false;
        for (const fieldName of this.fields) {
            let fieldMatch = false;
            const fieldValue = (study as any)[fieldName];
            if (fieldValue) {
                fieldMatch = matchPhrase(this.phrase, fieldValue);
            }
            anyFieldMatch = anyFieldMatch || fieldMatch;
        }
        return anyFieldMatch;
    }

    equals(other: Phrase): boolean {
        if (!other) {
            return false;
        }
        const o = other as DefaultPhrase;
        if (!o.phrase || !o.fields) {
            return false;
        }
        if (this.phrase !== o.phrase) {
            return false;
        }
        return _.isEqual(this.fields, o.fields);
    }
}

/**
 * Match studies by one or more values
 * Shape: <prefix>:<phrase> in which phrase
 * is a comma separated list of values
 */
export class ListPhrase implements Phrase {
    protected readonly _textRepresentation: string;
    private readonly _fields: CancerTreeNodeFields[];
    private readonly _phraseList: string[];
    private readonly _prefix: string;

    constructor(
        phrase: string,
        textRepresentation: string,
        fields: CancerTreeNodeFields[]
    ) {
        this._fields = fields;
        this._phraseList = phrase.split(FILTER_VALUE_SEPARATOR);
        this._textRepresentation = textRepresentation;
        this._prefix = textRepresentation.split(FILTER_SEPARATOR)[0];
    }

    public get phrase() {
        return this._phraseList.join(FILTER_VALUE_SEPARATOR);
    }

    public get fields() {
        return this._fields;
    }

    public get prefix() {
        return this._prefix;
    }

    public get phraseList() {
        return this._phraseList;
    }

    public toString() {
        return this._textRepresentation;
    }

    public match(study: CancerTreeNode): boolean {
        let anyFieldMatch = false;
        for (const fieldName of this.fields) {
            let fieldMatch = false;
            const fieldValue = (study as any)[fieldName];
            if (fieldValue) {
                for (const phrase of this._phraseList) {
                    fieldMatch = matchPhrase(this.phrase, fieldValue);
                }
            }
            anyFieldMatch = anyFieldMatch || fieldMatch;
        }
        return anyFieldMatch;
    }

    equals(other: Phrase): boolean {
        if (!other) {
            return false;
        }
        const o = other as ListPhrase;
        if (!o._phraseList || !o.fields) {
            return false;
        }
        if (!_.isEqual(this._phraseList, o._phraseList)) {
            return false;
        }
        return _.isEqual(this.fields, o.fields);
    }
}

export type SearchResult = {
    match: boolean;
    forced: boolean;
};

export type QueryUpdate = {
    toAdd: ISearchClause[];

    /**
     * Remove phrases, ignoring the type of their containing Clause
     * to prevent conflicting clauses
     */
    toRemove: Phrase[];
};

function matchPhrase(phrase: string, fullText: string) {
    return fullText.toLowerCase().indexOf(phrase.toLowerCase()) > -1;
}
