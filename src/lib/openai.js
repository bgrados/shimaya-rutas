import OpenAI from "openai";

export const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export async function preguntarIA(mensaje) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: "Eres un asistente útil." },
            { role: "user", content: mensaje },
        ],
    });

    return response.choices[0].message.content;
}