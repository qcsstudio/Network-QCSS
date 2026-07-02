import mongoose from "mongoose";

const BlogSchema = new mongoose.Schema(
    {
        heading: {
            type: String,
            unique: true,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        thumbnail: {
            type: String,
            required: true,
        },
        sub_description: {
            type: String,
        },
        trending: {
            type: Boolean,
            default: false
        },
        slug: {
            type: String,
        },
        show_on_front: {
            type: Boolean,
            default: false
        },
        category: [
            {
                type: String
            }
        ],
        metaTitle: {
            type: String,
            default: "Title"
        },
        metaDescription: {
            type: String,
            default: "Description"
        }
    },
    { timestamps: true }
);

export default mongoose.models.Blog || mongoose.model("Blog", BlogSchema);