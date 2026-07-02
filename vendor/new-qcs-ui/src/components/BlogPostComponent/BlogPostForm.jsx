"use client";
import { useEffect, useState, useRef } from "react";
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { Toast } from 'primereact/toast';
import { AiFillFolderOpen } from "react-icons/ai";
import { TfiReload } from "react-icons/tfi";
import { ImCloudUpload } from "react-icons/im";
import Image from "next/image";
import { Editor } from "../JoditEditor/JoditEditor";



const BlogPostForm = () => {
  // State Management
  const [blogs, setBlogs] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    heading: "",
    description: "",
    thumbnail: "",
    slug:"",
    metaTitle:"" ,
    metaDescription:""
  });
  console.log(formData,"formDataformDataformData")
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });
  const [globalFilterValue, setGlobalFilterValue] = useState('');
  const toast = useRef(null);

  // Image Upload Handler -----------------------------------------------------------
  const [thumbnail, setThumbnail] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageShow, setImageShow] = useState(null);

  useEffect(()=>{
    if(blogs.length > 0){
      setThumbnail(blogs.thumbnail);
    }
  },[blogs]);

const handleImageChange = async (e) => {
  setLoading(true);
  const imageData = e?.target?.files[0];
  if (!imageData) { 
    setLoading(false); 
    return; 
  }

  try {
    // Create FormData
    const formData = new FormData();
    formData.append('file', imageData);

    // Upload via your API (no CORS issues!)
    const response = await fetch('/api/s3-upload-url', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    console.log("Upload Image URL:", data.url);
    setThumbnail(data.url);
    setImageShow(data.url);
    setLoading(false);

  } catch (error) {
    console.error("Upload error:", error);
    alert(`Upload failed: ${error.message}`);
    setLoading(false);
  }
};

  // Fetch Blogs
  const fetchBlogs = async () => {
    try {
      const res = await fetch("/api/blog");
      const data = await res.json();
      setBlogs(data);
    } catch (err) {
      showToast('error', 'Error', 'Failed to fetch blogs');
      console.error("Failed to fetch blogs:", err);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  // Toast Notification
  const showToast = (severity, summary, detail) => {
    toast.current.show({ severity, summary, detail, life: 3000 });
  };

  // Form Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
 
    const method = editingId ? "PUT" : "POST";
    const url = editingId
      ? `/api/blog/${encodeURIComponent(formData.slug)}`
      : `/api/blog`;
    formData.thumbnail = thumbnail;
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save blog");
      }

      showToast('success', 'Success', editingId ? 'Blog updated successfully' : 'Blog created successfully');
      setModalOpen(false);
      setFormData({ heading: "", description: "", thumbnail: "" });
      setEditingId(null);
      fetchBlogs();
    } catch (err) {
      console.error("Submission error:", err);
      showToast('error', 'Error', err.message);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Blog
  const handleDelete = async (blog) => {
    try {
      const res = await fetch(`/api/blog/${encodeURIComponent(blog.heading)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error('Failed to delete blog');

      showToast('success', 'Success', 'Blog deleted successfully');
      fetchBlogs();
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  };

  // Edit Blog
  const handleEdit = (blog) => {
    setFormData(blog);
    setEditingId(blog.slug); // Store the heading as the identifier
    setModalOpen(true);
  };

  // Search Functionality
  const onGlobalFilterChange = (e) => {
    const value = e.target.value;
    let _filters = { ...filters };
    _filters['global'].value = value;
    setFilters(_filters);
    setGlobalFilterValue(value);
  };



  // Table Header with Search
  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center ">
        <h2 className={`text-2xl font-bold font-unbounded`}>Blog Posts</h2>
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder=""
          />
        </span>
      </div>
    );
  };

  // Table Columns Templates
  const thumbnailBodyTemplate = (rowData) => {
    return (
      <img
        src={rowData.thumbnail || 'https://placehold.co/100x60'}
        alt={`Thumbnail for ${rowData.heading || "blog post"}`}
        width="200"
        height="100"
        loading="lazy"
        className="object-cover rounded"
      />
    );
  };

const descriptionBodyTemplate = (rowData) => {
  const stripHtml = (html) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  const text = stripHtml(rowData.description);
  const words = text.split(" ");

  const limitedText =
    words.length > 15
      ? words.slice(0, 15).join(" ") + "..."
      : text;

  return <div className="max-w-xs">{limitedText}</div>;
};


  const actionBodyTemplate = (rowData) => {
    console.log(rowData,"rowDatarowData");
    return (
      <div className="flex gap-2 ">
        <Button
          icon="pi pi-pencil"
          className="p-button-rounded p-button-success p-button-text"
          onClick={() => handleEdit(rowData)}
          tooltip="Edit"
          tooltipOptions={{ position: 'top' }}
        />
        <Button
          icon="pi pi-trash"
          className="p-button-rounded p-button-danger p-button-text"
          onClick={() => handleDelete(rowData)} // Pass the full rowData
          tooltip="Delete"
          tooltipOptions={{ position: 'top' }}
        />
      </div>
    );
  };

  const header = renderHeader();

  return (
    <div className="p-6 border  float-end" style={{width:"90%"}}>
      <Toast ref={toast} position="top-right" />

      {/* DataTable */}
      <div className="card">
        <DataTable
          value={blogs}
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          tableStyle={{ minWidth: '50rem' }}
          filters={filters}
          filterDisplay="menu"
          globalFilterFields={['heading']}
          header={header}
          emptyMessage="No blog posts found."
        >
          <Column field="heading" header="Title" sortable />
          <Column
            field="thumbnail"
            header="Thumbnail"
            body={thumbnailBodyTemplate}
          />
          <Column
            field="description"
            header="Content"
            body={descriptionBodyTemplate}
          />
          <Column
            body={actionBodyTemplate}
            header="Actions"
            style={{ width: '8rem' }}
          />
        </DataTable>
      </div>

      {/* Floating Add Button */}
      <Button
        icon="pi pi-plus"
        className="p-button-rounded p-button-raised fixed bottom-5 right-5"
        onClick={() => {
          setFormData({ heading: "", description: "", thumbnail: "" });
          setEditingId(null);
          setModalOpen(true);
        }}
        tooltip="Add New Blog"
      />

      {/* Blog Form Dialog */}
      <Dialog
        visible={modalOpen}
        onHide={() => {
          setModalOpen(false);
          setEditingId(null);
          setFormData({ heading: "", description: "", thumbnail: "" });
        }}
        style={{ width: '50vw' }}
        header={editingId ? "Edit Blog Post" : "Add Blog Post"}
        modal
        className="p-fluid"
        breakpoints={{ '960px': '75vw', '641px': '90vw' }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Blog Title */}
          <div className="field">
            <label htmlFor="heading" className="font-medium">
              Title *
            </label>
            <InputText
              id="heading"
              value={formData.heading}
              onChange={(e) =>
                setFormData({ ...formData, heading: e.target.value })
              }
              required
            />
             <label htmlFor="heading" className="font-medium">
              Slug *
            </label>
            <InputText
              id="slug"
              placeholder="Enter Slug.."
              value={formData.slug}
              onChange={(e) =>
                setFormData({ ...formData, slug: e.target.value })
              }
              required
            />
             <label htmlFor="heading" className="font-medium">
              Meta Title *
            </label>
            <InputText
              id="metaTitle"
              placeholder="Enter Meta Title.."
              value={formData.metaTitle}
              onChange={(e) =>
                setFormData({ ...formData, metaTitle: e.target.value })
              }
              required
            />
            <label htmlFor="heading" className="font-medium">
              Meta Description *
            </label>
            <InputText
              id="metaDescription"
              placeholder="Enter Meta Description.."
              value={formData.metaDescription}
              onChange={(e) =>
                setFormData({ ...formData, metaDescription: e.target.value })
              }
              required
            />
          </div>

          {/* Blog Description */}
          <div className="field">
            <label htmlFor="description" className="font-medium">
              Content *
            </label>
           
            <Editor
            content={formData} setContent={setFormData}
             />
          </div>

          {/* Thumbnail URL */}
          <div className="buttonsContainer w-[100%] h-[15rem] flex gap-[1rem] border-[2px] border-dashed border-[#38bdf8]/50 rounded-[.7rem] relative">
            {/* Image Input */}
            {!imageShow && !loading && <><label htmlFor="avatar_Image" className="input w-[100%]  text-[#fff] flex flex-col justify-center items-center transition-all duration-300 ease-in-out hover:scale-[.99] cursor-pointer ">
              <AiFillFolderOpen className="text-[2rem] text-[#c1c1c1]"/>
              <p className="text-[1rem] text-[#c1c1c1]">Upload Image</p>
            </label>
            <input type="file"
              accept='image/*'
              name="avatar_Image"
              id="avatar_Image"
              style={{ display: "none" }}
              onChange={handleImageChange}
            /></>}
            {/* Image Input */}
            {imageShow && !loading && <><label htmlFor="avatar_Image" className="input w-[3rem] h-[3rem] absolute top-[-.5rem] right-[-.5rem] rounded-[50%]  text-[#fff] flex flex-col justify-center items-center transition-all duration-300 ease-in-out hover:scale-[.99] cursor-pointer z-[20] bg-[#38bdf8] ">
              <TfiReload className="text-[1.2rem] text-[#ffffff]"/>
            </label>
            <input type="file"
              accept='image/*'
              name="avatar_Image"
              id="avatar_Image"
              style={{ display: "none" }}
              onChange={handleImageChange}
              
            /></>}

            {imageShow && !loading && (
            <div className="flex justify-center w-[100%] h-[100%]">
              <Image src={imageShow} width={100} height={100} alt="Preview" className="rounded-[.7rem] w-[100%] h-[100%] object-center" />
            </div>)}

            {loading && !imageShow && <div className="loadingContainer w-[100%] h-[100%] flex justify-center items-center input flex-col">
              <ImCloudUpload className="text-[2rem] text-[#c1c1c1]"/>
              <p className="text-[#c1c1c1] mt-[1rem]">Uploading...</p>
            </div>}

          </div>

          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-md">
              Error: {error}
            </div>
          )}

          <div className="flex bottom-[-15px] sticky bg-white justify-end gap-2 mt-4">
            <Button
              label="Cancel"
              icon="pi pi-times"
              className="p-button-text"
              onClick={() => {
                setModalOpen(false);
                setEditingId(null);
                setFormData({ heading: "", description: "", thumbnail: "" });
              }}
            />
            <Button
              label={isSubmitting ? "Saving..." : "Save"}
              icon="pi pi-check"
              type="submit"
              loading={isSubmitting}
            />
          </div>
        </form>
      </Dialog>
    </div>
  );
};

export default BlogPostForm;