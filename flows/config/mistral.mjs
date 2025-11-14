import MistralClient from "@mistralai/mistralai";

const mistral = new MistralClient(process.env.MISTRAL_API_KEY || "Zvz0aEyGtNSUfSVRS3o3vKy9zi6E14wl");

export default mistral;
