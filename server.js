import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
app.use(express.json());

const server = new McpServer({
  name: "isango-travel-assistant",
  version: "1.0.0",
});

server.tool(
  "search_tours",
  "Search tours and activities for a destination or region on isango.",
  {
    region: z.string().min(1).describe("Destination, city, or region. Example: paris"),
  },
  async ({ region }) => {
    try {
      const response = await fetch(
        "https://distributorapi-uat.isango.com/searchTours",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ region }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `API error: ${response.status} ${response.statusText}\n${errorText}`,
            },
          ],
          isError: true,
        };
      }

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to search tours: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

app.post("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    }
  }
});

app.get("/", (req, res) => {
  res.send("Isango MCP server is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});