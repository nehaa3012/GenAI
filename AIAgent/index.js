import { GoogleGenAI, Type } from "@google/genai";
import readlineSync from "readline-sync";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// crypto currency price prediction 
async function cryptoCurrencyPrediction({ coin }) {
  try {
    const coinId = coin.toLowerCase().trim();
    console.log(`[Fetching crypto data for: ${coinId}]`);
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}`);

    if (!response.ok) {
      return { error: `Could not find cryptocurrency: ${coin}` };
    }

    const data = await response.json();

    return {
      name: data.name,
      symbol: data.symbol,
      current_price_usd: data.market_data?.current_price?.usd,
      market_cap: data.market_data?.market_cap?.usd,
      price_change_24h: data.market_data?.price_change_percentage_24h,
    };
  } catch (error) {
    return { error: `Error fetching crypto data: ${error.message}` };
  }
}

// weather prediction
async function weatherPrediction({ city }) {
  try {
    console.log(`[Fetching weather data for: ${city}]`);
    const response = await fetch(
      `http://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${city}&aqi=no`
    );

    if (!response.ok) {
      return { error: `Could not find weather for city: ${city}` };
    }

    const data = await response.json();

    return {
      location: data.location?.name,
      country: data.location?.country,
      temperature_c: data.current?.temp_c,
      temperature_f: data.current?.temp_f,
      condition: data.current?.condition?.text,
      humidity: data.current?.humidity,
      wind_kph: data.current?.wind_kph
    };
  } catch (error) {
    return { error: `Error fetching weather data: ${error.message}` };
  }
}

const toolFunctions = {
  cryptoCurrencyPrediction,
  weatherPrediction
}

const tools = [
  {
    functionDeclarations: [{
      name: "cryptoCurrencyPrediction",
      description: "Get the current price and information about cryptocurrencies like bitcoin, ethereum, etc. Use lowercase coin IDs (e.g., 'bitcoin', 'ethereum', 'dogecoin').",
      parameters: {
        type: Type.OBJECT,
        properties: {
          coin: {
            type: Type.STRING,
            description: "The ID of the cryptocurrency in lowercase (e.g., 'bitcoin', 'ethereum')",
          },
        },
        required: ["coin"],
      },
    },
    {
      name: "weatherPrediction",
      description: "Get the current weather information for any city.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          city: {
            type: Type.STRING,
            description: "The name of the city",
          },
        },
        required: ["city"],
      },
    }],
  },
];

let History = [];

async function runAgent() {

  // Loop until the model has no more function calls to make
  while (true) {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: History,
      config: { tools },
    });

    if (result.functionCalls && result.functionCalls.length > 0) {
      const functionCall = result.functionCalls[0];

      const { name, args } = functionCall;

      if (!toolFunctions[name]) {
        throw new Error(`Unknown function call: ${name}`);
      }

      // Call the function and get the response.
      const toolResponse = await toolFunctions[name](args);

      const functionResponsePart = {
        name: functionCall.name,
        response: {
          result: toolResponse,
        },
      };

      // Send the function response back to the model.
      History.push({
        role: "model",
        parts: [{ functionCall: functionCall }],
      });
      History.push({
        role: "user",
        parts: [{ functionResponse: functionResponsePart }],
      });
    }
    else {
      // No more function calls, break the loop.
      History.push({
        role: "model",
        parts: [{ text: result.text }],
      });
      console.log(result.text);
      break;
    }
  }

}

while (true) {
  const userInput = readlineSync.question("User: ");

  if (userInput.toLowerCase() === "exit") {
    break;
  }

  History.push({
    role: "user",
    parts: [{ text: userInput }],
  });
  await runAgent();
}