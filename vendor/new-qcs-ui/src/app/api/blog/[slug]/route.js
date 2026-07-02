import { NextResponse } from 'next/server';
import Blog from '@/models/blogs';
import connectMongo from '@/lib/mongodb';

export async function GET(req,{ params }) {
  const { slug } =   params;
  await connectMongo();
 
  console.log(params,"====>")
  try {
    const blog = await Blog.findOne({ slug: decodeURIComponent(slug) });
    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }
    return NextResponse.json(blog, { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch blog', message: error.message }, { status: 500 });
  }
}


export async function PUT(req, { params }) {
  await connectMongo();
  const { slug } = params;

  try {
    const data = await req.json();
    const updatedBlog = await Blog.findOneAndUpdate(
      { heading: decodeURIComponent(slug) },
      data,
      { new: true }
    );

    if (!updatedBlog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    return NextResponse.json(updatedBlog, { status: 200 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: 'Failed to update blog', message: error.message }, { status: 500 });
  }
}


export async function DELETE(req, { params }) {
  await connectMongo();
  const { slug } = params;
  console.log("DELETE slug:", slug);

  try {
    const deletedBlog = await Blog.findOneAndDelete({ heading: decodeURIComponent(slug) });
    if (!deletedBlog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Blog deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete blog' }, { status: 500 });
  }
}