import { MongoClient, ObjectId } from 'mongodb'
import { BookModel } from "./types.ts"

// conseguimos mongo url
const MONGO_URL = Deno.env.get("MONGO_URL")
if (!MONGO_URL) {
    console.log("No mongo url found!")
    Deno.exit(1)
}

const client = new MongoClient(MONGO_URL)
await client.connect()
console.log("Conected to database!")

const db = client.db("library")
const booksCollection = db.collection<BookModel>("books")

const handler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    if (method === "GET") {
        if (path === "/books") {
            const booksDb = await booksCollection.find().toArray()
            const books = booksDb.map(book => ({
                id: book._id!.toString(),
                title: book.title,
                author: book.author,
                year: book.year
            }))

            return new Response(JSON.stringify(books), { status: 200 })
        } else if (path.includes("/books/")) {
            const id = path.split("/books/")[1]

            try {
                const bookDb = await booksCollection.findOne({ _id: new ObjectId(id) })
                if (!bookDb) {
                    return new Response(JSON.stringify({ error: "Libro no encontrado" }), { status: 404 })
                }

                const book = {
                    id: bookDb._id!.toString(),
                    title: bookDb.title,
                    author: bookDb.author,
                    year: bookDb.year
                }

                return new Response(JSON.stringify(book), { status: 200 })
            } catch {
                return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 })
            }
        }

        return new Response("Path not found in GET method", { status: 404 })
    } else if (method === "POST") {
        if (path === "/books") {
            try {
                const body = await req.json()

                if (!body.title || !body.author || !body.year) {
                    return new Response(JSON.stringify({
                        error: "Faltan campos requeridos (title, author, year)"
                    }), { status: 400 })
                }

                const existbookbytitle = await booksCollection.findOne({ title: body.title })
                if (existbookbytitle) {
                    return new Response(JSON.stringify({
                        error: "El libro ya está registrado."
                    }), { status: 400 })
                }

                const insertResult = await booksCollection.insertOne({
                    title: body.title,
                    author: body.author,
                    year: body.year,
                })

                return new Response(JSON.stringify({
                    id: insertResult.insertedId.toString(),
                    title: body.title,
                    author: body.author,
                    year: body.year
                }), { status: 201 })
            } catch {
                return new Response(JSON.stringify({ error: "Cuerpo malformado o faltan campos" }), { status: 400 })
            }
        }

        return new Response("Path not found in POST method", { status: 404 })
    } else if (method === "PUT") {
        if (path.includes("/books/")) {
            const id = path.split("/books/")[1]

            try {
                const body = await req.json()
                const updateFields: Partial<BookModel> = {}

                if (body.title) updateFields.title = body.title
                if (body.author) updateFields.author = body.author
                if (body.year) updateFields.year = body.year

                if (Object.keys(updateFields).length === 0) {
                    return new Response(JSON.stringify({
                        error: "Debe enviar al menos un campo para actualizar (title, author, year)"
                    }), { status: 400 })
                }

                const result = await booksCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateFields }
                )

                if (result.modifiedCount === 0) {
                    return new Response(JSON.stringify({ error: "Libro no encontrado" }), { status: 404 })
                }

                return new Response(JSON.stringify({
                    id: id,
                    ...updateFields
                }), { status: 200 })
            } catch {
                return new Response(JSON.stringify({ error: "ID inválido o cuerpo malformado" }), { status: 400 })
            }
        }

        return new Response("Path not found in PUT method", { status: 404 })
    } else if (method === "DELETE") {
        if (path.includes("/books/")) {
            const id = path.split("/books/")[1]

            try {
                const result = await booksCollection.deleteOne({ _id: new ObjectId(id) })

                if (result.deletedCount === 0) {
                    return new Response(JSON.stringify({ error: "Libro no encontrado" }), { status: 404 })
                }

                return new Response(JSON.stringify({ message: "Libro eliminado correctamente" }), { status: 200 })
            } catch {
                return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 })
            }
        }

        return new Response("Path not found in DELETE method", { status: 404 })
    }

    return new Response("Request type not found", { status: 404 })
}

Deno.serve({ port: 4000 }, handler)
