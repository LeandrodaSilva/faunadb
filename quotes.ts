import {
  json,
  serve,
  validateRequest,
} from "https://deno.land/x/sift@0.3.5/mod.ts";

serve({
  "/quotes": handleQuotes,
});

async function handleQuotes(request: Request) {
  // Make sure the request is a GET request.
  const { error, body } = await validateRequest(request, {
    GET: {},
    POST: {
      body: ["quote", "author"],
    },
  });
  // validateRequest populates the error if the request doesn't meet
  // the schema we defined.
  if (error) {
    return json({ error: error.message }, { status: error.status });
  }

  // Handle POST requests.
  if (request.method === "POST") {
    const { quote, author, error } = await createQuote(
      body as { quote: string; author: string },
    );
    if (error) {
      return json({ error: "couldn't create the quote" }, { status: 500 });
    }
    // Return all the quotes.
    return json({ quote, author }, { status: 201 });
  }

  // It's assumed that the request method is "GET".
  {
    const { quotes, error } = await getAllQuotes();
    if (error) {
      return json({ error: "couldn't fetch the quotes" }, { status: 500 });
    }

    return json({ quotes });
  }
}

async function createQuote({
  quote,
  author,
}: {
  quote: string;
  author: string;
}): Promise<{ quote?: string; author?: string; error?: string }> {
  const query = `
    mutation($quote: String!, $author: String!) {
      createQuote(data: { quote: $quote, author: $author }) {
        quote
        author
      }
    }
  `;

  const { data, error } = await queryFauna(query, { quote, author });
  if (error) {
    return { error };
  }

  return data;
}

async function queryFauna(
  query: string,
  variables: { [key: string]: unknown },
): Promise<{
  data?: any;
  error?: any;
}> {
  // Grab the secret from the environment.
  const token = Deno.env.get("FAUNA_SECRET");
  if (!token) {
    throw new Error("environment variable FAUNA_SECRET not set");
  }

  try {
    // Make a POST request to fauna's graphql endpoint with body being
    // the query and its variables.
    const res = await fetch("https://graphql.us.fauna.com/graphql", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    const { data, errors } = await res.json();
    if (errors) {
      // Return the first error if there are any.
      return { data, error: errors[0] };
    }

    return { data };
  } catch (error) {
    return { error };
  }
}

async function getAllQuotes() {
  const query = `
    query {
      allQuotes {
        data {
          quote
          author
        }
      }
    }
  `;

  const {
    data: {
      allQuotes: { data: quotes },
    },
    error,
  } = await queryFauna(query, {});
  if (error) {
    return { error };
  }

  return { quotes };
}
