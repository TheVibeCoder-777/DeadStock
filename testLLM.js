import { LlamaChatSession, getLlama, LlamaJsonSchemaGrammar } from 'node-llama-cpp';

async function test() {
    console.log('Loading llama...');
    const llama = await getLlama();
    console.log('Loading model...');
    const model = await llama.loadModel({ modelPath: 'd:/DeadStock/models/mistral-7b-instruct-v0.2.Q4_K_M.gguf' });
    console.log('Creating context...');
    const context = await model.createContext({ contextSize: 2048 });

    const systemPrompt = `You are a database query generator for a local lowDB json database. 
Your ONLY job is to convert natural language queries into a JSON filter object.
Do NOT include any explanations, greetings, or markdown blocks. RETURN ONLY VALID JSON.
If the query is ambiguous, return exactly { "error": "Ambiguous query" }.

Available collections: ["hardware","employees","eWaste","permanentAllocations"]
Common Hardware Fields: ["Category","Make","Date_of_Purchase"]
Common Employee Fields: ["Name","Employee_ID","Post","Office"]

Output Format Requirements: 
Return a JSON object with:
- "collection": the name of the most appropriate collection
- "filter": an object with key-value pairs representing the search criteria.
  - Dates should be converted to match the 'YYYY-MM-DD' or similar format used in the values. Use substring matches or precise dates if given a full date.

Example 1:
User: "Show me all HP laptops"
Output: { "collection": "hardware", "filter": { "Category": "LAPTOP", "Make": "HP" } }

Remember: Output ONLY valid JSON starting with { and ending with }, nothing else. No conversational text.`;

    const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: systemPrompt
    });

    const grammar = new LlamaJsonSchemaGrammar(llama, {
        type: "object",
        properties: {
            collection: {
                type: "string",
                enum: ["hardware", "employees", "eWaste", "permanentAllocations"]
            },
            filter: {
                type: "object",
                additionalProperties: { type: "string" }
            }
        },
        required: ["collection", "filter"],
        additionalProperties: false
    });

    console.log('Prompting...');
    try {
        const result = await session.prompt('Show me all laptops purchased on 07-09-2018', {
            temperature: 0.1,
            maxTokens: 256,
            grammar: grammar
        });
        console.log('Raw Result String:', result);

        // Emulate the JSON parsing from the route
        let cleanResponse = result.trim();
        const objectMatch = cleanResponse.match(/\{[\s\S]*\}/);

        if (objectMatch) {
            cleanResponse = objectMatch[0];
            console.log("Matched JSON Block:", cleanResponse);
        } else {
            console.log("Regex fell back to codeblock check");
        }

        const parsed = JSON.parse(cleanResponse);
        console.log('Successfully Parsed:', parsed);
    } catch (e) {
        console.error('Failed to Parse:', e);
    }

    await context.dispose();
}

test().catch(console.error);
