export interface TemplateVariable {
    name: string;
    label: string;
    type: 'text' | 'date' | 'number';
}

/**
 * Extracts unique variables from a markdown string using the {{variableName}} pattern.
 */
export function extractVariables(markdown: string): TemplateVariable[] {
    const regex = /{{(.*?)}}/g;
    const matches = markdown.matchAll(regex);
    const variables = new Set<string>();

    for (const match of matches) {
        variables.add(match[1].trim());
    }

    return Array.from(variables).map(name => ({
        name,
        label: name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim(),
        type: name.toLowerCase().includes('data') ? 'date' : 'text',
    }));
}

/**
 * Replaces variables in a markdown string with values from an object.
 */
export function replaceVariables(markdown: string, values: Record<string, string>): string {
    let result = markdown;
    for (const [key, value] of Object.entries(values)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value || `{{${key}}}`);
    }
    return result;
}
