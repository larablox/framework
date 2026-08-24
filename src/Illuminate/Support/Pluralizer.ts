/**
 * PHP: `Illuminate\Support\Pluralizer`, which delegates to Doctrine Inflector.
 *
 * Doctrine is not available, so this carries a compact English ruleset of its
 * own: the common irregulars and uncountables plus the standard suffix rules.
 * It covers everyday words, not Doctrine's full table -- if a word matters,
 * check it. Luau patterns have no alternation, so each PHP alternative is
 * spelled out as its own rule.
 */
const IRREGULAR: Array<[string, string]> = [
    ["child", "children"],
    ["die", "dice"],
    ["foot", "feet"],
    ["goose", "geese"],
    ["louse", "lice"],
    ["man", "men"],
    ["mouse", "mice"],
    ["ox", "oxen"],
    ["person", "people"],
    ["tooth", "teeth"],
    ["woman", "women"],
];

const UNCOUNTABLE = [
    "aircraft",
    "audio",
    "deer",
    "equipment",
    "evidence",
    "fish",
    "furniture",
    "gold",
    "information",
    "money",
    "news",
    "police",
    "recommended",
    "related",
    "rice",
    "series",
    "sheep",
    "species",
    "staff",
    "traffic",
];

const PLURAL_RULES: Array<[string, string]> = [
    ["(quiz)$", "%1zes"],
    ["([ml])ouse$", "%1ice"],
    ["(matr)ix$", "%1ices"],
    ["(vert)ex$", "%1ices"],
    ["(ind)ex$", "%1ices"],
    ["(octop)us$", "%1i"],
    ["(vir)us$", "%1i"],
    ["(ax)is$", "%1es"],
    ["(test)is$", "%1es"],
    ["(alias)$", "%1es"],
    ["(status)$", "%1es"],
    ["(bu)s$", "%1ses"],
    ["(buffal)o$", "%1oes"],
    ["(tomat)o$", "%1oes"],
    ["(potat)o$", "%1oes"],
    ["(her)o$", "%1oes"],
    ["([ti])um$", "%1a"],
    ["sis$", "ses"],
    ["([^f])fe$", "%1ves"],
    ["([lr])f$", "%1ves"],
    ["(hive)$", "%1s"],
    ["([^aeiouy])y$", "%1ies"],
    ["(x)$", "%1es"],
    ["(ch)$", "%1es"],
    ["(ss)$", "%1es"],
    ["(sh)$", "%1es"],
    ["s$", "s"],
    ["$", "s"],
];

const SINGULAR_RULES: Array<[string, string]> = [
    ["(quiz)zes$", "%1"],
    ["(matr)ices$", "%1ix"],
    ["(vert)ices$", "%1ex"],
    ["(ind)ices$", "%1ex"],
    ["^(ox)en$", "%1"],
    ["(alias)es$", "%1"],
    ["(status)es$", "%1"],
    ["(octop)i$", "%1us"],
    ["(vir)i$", "%1us"],
    ["(cris)es$", "%1is"],
    ["(test)es$", "%1is"],
    ["(ax)es$", "%1is"],
    ["(shoe)s$", "%1"],
    ["(o)es$", "%1"],
    ["(bus)es$", "%1"],
    ["([ml])ice$", "%1ouse"],
    ["(x)es$", "%1"],
    ["(ch)es$", "%1"],
    ["(ss)es$", "%1"],
    ["(sh)es$", "%1"],
    ["([ti])a$", "%1um"],
    ["(analy)ses$", "%1sis"],
    ["(ba)ses$", "%1sis"],
    ["(diagno)ses$", "%1sis"],
    ["(parenthe)ses$", "%1sis"],
    ["([^f])ves$", "%1fe"],
    ["([lr])ves$", "%1f"],
    ["(hive)s$", "%1"],
    ["([^aeiouy])ies$", "%1y"],
    ["(s)s$", "%1"],
    ["s$", ""],
];

export class Pluralizer {
    /** Words that should not be inflected. */
    public static uncountable = UNCOUNTABLE;

    /** Get the plural form of an English word. */
    public static plural(value: string, count = 2): string {
        if (math.abs(count) === 1 || Pluralizer.isUncountable(value)) {
            return value;
        }

        return Pluralizer.matchCase(
            Pluralizer.inflect(value, PLURAL_RULES),
            value,
        );
    }

    /** Get the singular form of an English word. */
    public static singular(value: string): string {
        if (Pluralizer.isUncountable(value)) {
            return value;
        }

        return Pluralizer.matchCase(
            Pluralizer.inflect(value, SINGULAR_RULES),
            value,
        );
    }

    /** Determine if the given value is uncountable. */
    protected static isUncountable(value: string): boolean {
        return Pluralizer.uncountable.includes(value.lower());
    }

    /** Apply the first rule that matches, irregulars first. */
    protected static inflect(
        value: string,
        rules: Array<[string, string]>,
    ): string {
        const lowered = value.lower();
        const plural = rules === PLURAL_RULES;

        for (const [singular, pluralForm] of IRREGULAR) {
            if (plural && lowered === singular) {
                return pluralForm;
            }

            if (!plural && lowered === pluralForm) {
                return singular;
            }
        }

        for (const [pattern, replacement] of rules) {
            const [matched] = lowered.match(pattern);

            if (matched !== undefined) {
                const [result] = lowered.gsub(pattern, replacement, 1);

                return result;
            }
        }

        return value;
    }

    /** Attempt to match the case of the inflected word to the original. */
    protected static matchCase(value: string, comparison: string): string {
        if (comparison.lower() === comparison) {
            return value.lower();
        }

        if (comparison.upper() === comparison) {
            return value.upper();
        }

        if (comparison.sub(1, 1).upper() + comparison.sub(2) === comparison) {
            return value.sub(1, 1).upper() + value.sub(2);
        }

        return value;
    }
}
