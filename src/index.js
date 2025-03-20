import {
    getSearch,
    getAnime,
    getRecentAnime,
    getPopularAnime,
    getEpisode,
    GogoDLScrapper,
    getGogoAuthKey,
} from "./gogo";

import {
    getAnilistTrending,
    getAnilistSearch,
    getAnilistAnime,
    getAnilistUpcoming,
} from "./anilist";
import { SaveError } from "./errorHandler";
import { increaseViews } from "./statsHandler";

// Global cache object
const CACHE = {};

// CORS headers
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

// Helper function to add CORS headers to responses
function addCorsHeaders(response) {
    return new Response(response.body, {
        ...response,
        headers: { ...response.headers, ...corsHeaders },
    });
}

// Handle CORS preflight requests
function handleOptions(request) {
    return new Response(null, {
        headers: corsHeaders,
    });
}

// Helper function to manage caching
async function getCachedData(cacheKey, cacheTimeKey, cacheDuration, fetchData) {
    const cachedData = CACHE[cacheKey];
    const cachedTime = CACHE[cacheTimeKey];
    const currentTime = Math.floor(Date.now() / 1000);

    if (cachedData && cachedTime && currentTime - cachedTime < cacheDuration) {
        return cachedData;
    }

    const data = await fetchData();
    CACHE[cacheKey] = data;
    CACHE[cacheTimeKey] = currentTime;
    return data;
}

// Main fetch handler
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight requests
        if (request.method === "OPTIONS") {
            return handleOptions(request);
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // Increase views for analytics
            await increaseViews(request.headers);

            // Route handling
            if (path.startsWith("/search/")) {
                const query = path.split("/search/")[1].split("?")[0];
                const page = url.searchParams.get("page") || 1;

                const data = await getCachedData(
                    `search_${query}_${page}`,
                    `time_search_${query}_${page}`,
                    60 * 60, // Cache for 1 hour
                    () => getSearch(query, page)
                );

                if (data.length === 0) {
                    return addCorsHeaders(new Response(JSON.stringify({ error: "Not found" }), {
                        status: 404,
                    }));
                }

                return addCorsHeaders(new Response(JSON.stringify({ results: data })));
            }

            if (path.startsWith("/anime/")) {
                const animeId = path.split("/anime/")[1];

                const data = await getCachedData(
                    `anime_${animeId}`,
                    `time_anime_${animeId}`,
                    60 * 60, // Cache for 1 hour
                    async () => {
                        let data;
                        try {
                            data = await getAnime(animeId);
                            if (!data.name) throw new Error("Not found");
                            data.source = "gogoanime";
                        } catch (err) {
                            const search = await getSearch(animeId);
                            if (search.length === 0) throw new Error("Not found");
                            data = await getAnime(search[0].id);
                            data.source = "gogoanime";
                        }
                        return data;
                    }
                );

                return addCorsHeaders(new Response(JSON.stringify({ results: data })));
            }

            if (path.startsWith("/episode/")) {
                const episodeId = path.split("/episode/")[1];
                const data = await getEpisode(episodeId);
                return addCorsHeaders(new Response(JSON.stringify({ results: data })));
            }

            if (path.startsWith("/download/")) {
                const episodeId = path.split("/download/")[1];
                const cookie = await getGogoAuthKey();
                const data = await GogoDLScrapper(episodeId, cookie);
                return addCorsHeaders(new Response(JSON.stringify({ results: data })));
            }

            if (path.startsWith("/recent/")) {
                const page = path.split("/recent/")[1];

                const data = await getCachedData(
                    `recent_${page}`,
                    `time_recent_${page}`,
                    5 * 60, // Cache for 5 minutes
                    () => getRecentAnime(page)
                );

                return addCorsHeaders(new Response(JSON.stringify({ results: data })));
            }

            if (path.startsWith("/recommendations/")) {
                const query = path.split("/recommendations/")[1];

                const data = await getCachedData(
                    `recommendations_${query}`,
                    `time_recommendations_${query}`,
                    60 * 60, // Cache for 1 hour
                    async () => {
                        const search = await getAnilistSearch(query);
                        if (search.results.length === 0) throw new Error("Not found");
                        const anime = await getAnilistAnime(search.results[0].id);
                        return anime.recommendations;
                    }
                );

                return addCorsHeaders(new Response(JSON.stringify({ results: data })));
            }

            if (path.startsWith("/gogoPopular/")) {
                const page = path.split("/gogoPopular/")[1];

                const data = await getCachedData(
                    `gogoPopular_${page}`,
                    `time_gogoPopular_${page}`,
                    10 * 60, // Cache for 10 minutes
                    () => getPopularAnime(page, 20)
                );

                return addCorsHeaders(new Response(JSON.stringify({ results: data })));
            }

            if (path.startsWith("/upcoming/")) {
                const page = path.split("/upcoming/")[1];

                const data = await getCachedData(
                    `upcoming_${page}`,
                    `time_upcoming_${page}`,
                    60 * 60, // Cache for 1 hour
                    async () => {
                        const result = await getAnilistUpcoming(page);
                        return result.results;
                    }
                );

                return addCorsHeaders(new Response(JSON.stringify({ results: data })));
            }

            // Default response for the root path
            if (path === "/") {
                const html = `<!doctype html><html lang=en><meta charset=UTF-8><meta content="width=device-width,initial-scale=1"name=viewport><title>AB API</title><style>body{font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;margin:0;padding:0;background-color:#f8f9fa;color:#495057;line-height:1.6}header{background-color:#343a40;color:#fff;text-align:center;padding:1.5em 0;margin-bottom:1em}h1{margin-bottom:.5em;font-size:2em;color:#17a2b8}p{color:#6c757d;margin-bottom:1.5em}code{background-color:#f3f4f7;padding:.2em .4em;border-radius:4px;font-family:"Courier New",Courier,monospace;color:#495057}.container{margin:1em;padding:1em;background-color:#fff;border-radius:8px;box-shadow:0 0 10px rgba(0,0,0,.1)}li,ul{list-style:none;padding:0;margin:0}li{margin-bottom:.5em}li code{background-color:#e5e7eb;color:#495057}a{color:#17a2b8;text-decoration:none}a:hover{text-decoration:underline}footer{background-color:#343a40;color:#fff;padding:1em 0;text-align:center}.sample-request{margin-top:1em}.toggle-response{cursor:pointer;color:#17a2b8;text-decoration:underline}.sample-response{display:none;margin-top:1em}pre{background-color:#f3f4f7;padding:1em;border-radius:4px;overflow-x:auto}</style><header><h1>API Dashboard</h1><p>The API provides access to a wide range of anime-related data.<p class=support>For support, contact me on <a href=https://wa.me/233533763772 target=_blank> whatsapp me</a>.</header><div class=container><h2>API Description:</h2><p>The AB API allows you to access various anime-related data, including search, anime details, episodes, downloads, recent releases, recommendations, popular anime, and upcoming releases. Data is scraped from gogoanime and anilist.</div><div class=container><h2>Routes:</h2><ul><li><code>/home</code> - Get trending anime from Anilist and popular anime from GogoAnime<li><code>/search/{query}</code> - Search for anime by name (query = anime name)<li><code>/anime/{id}</code> - Get details of a specific anime (id = gogoanime anime id)<li><code>/episode/{id}</code> - Get episode stream urls (id = gogoanime episode id)<li><code>/download/{id}</code> - Get episode download urls (id = gogoanime episode id)<li><code>/recent/{page}</code> - Get recent animes from gogoanime (page = 1,2,3...)<li><code>/recommendations/{query}</code> - Get recommendations of anime from anilist (id = anime name)<li><code>/gogoPopular/{page}</code> - Get popular animes from gogoanime (page = 1,2,3...)<li><code>/upcoming/{page}</code> - Get upcoming animes from anilist (page = 1,2,3...)</ul></div><div class=container><h2>Support and Contact:</h2><p>For support and questions, visit our <a href=https://wa.me/233533763772 target=_blank>Contact  me </a>.</div><footer><p>© 2024 AB STREAM API. All rights reserved.</footer>
                `;

                return new Response(html, {
                    headers: { "content-type": "text/html" },
                });
            }

            // Handle unknown routes
            return new Response("Not Found", { status: 404 });
        } catch (error) {
            // Log errors and return a 500 response
            await SaveError(error);
            return addCorsHeaders(new Response(JSON.stringify({ error: "Internal Server Error" }), {
                status: 500,
            }));
        }
    },
};
