import express from "express";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

const SHOPIFY_DOMAIN = "anatta-test-store.myshopify.com";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const GRAPHQL_URL = `https://${SHOPIFY_DOMAIN}/admin/api/2025-01/graphql.json`;

app.get("/fetch-products", async (req, res) => {
  try {
    const { title } = req.query;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    let allVariants = [];
    let nextCursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        const afterCursor = nextCursor ? `"${nextCursor}"` : null;

        const query = `
        query {
          products(query: "title:*'${title}'*", first: 1, after: ${afterCursor}) {
            pageInfo {
              hasNextPage
              hasPreviousPage
            }
            edges {
              cursor
              node {
                id
                title
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                      price
                    }
                  }
                }
              }
            }
          }
        }`;

        const response = await axios.post(
          GRAPHQL_URL,
          { query },
          {
            headers: {
              "X-Shopify-Access-Token": ADMIN_TOKEN,
              "Content-Type": "application/json",
            },
          }
        );

        const products = response.data.data.products;
        if (!products.edges.length) break;

        products.edges.forEach((product) => {
          nextCursor = product.cursor;
          product.node.variants.edges.forEach((variant) => {
            allVariants.push(
              `${product.node.title} - ${variant.node.title} - $${parseFloat(variant.node.price)}`
            );
          });
        });

        hasNextPage = products.pageInfo.hasNextPage;
      } catch (error) {
        console.error("Skipping a page due to an error:", error.response?.data || error.message);
        break;
      }
    }

    allVariants.sort((a, b) => {
      const priceA = parseFloat(a.split(" - $")[1]);
      const priceB = parseFloat(b.split(" - $")[1]);
      return priceA - priceB;
    });

    res.json(allVariants);
  } catch (error) {
    console.error("Error fetching products:", error, error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});