"use client";
import { useState, useEffect, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';
import { Toast } from 'primereact/toast';
import Link from 'next/link';

function Application({ email }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });
  const [filters, setFilters] = useState({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });
  const [globalFilterValue, setGlobalFilterValue] = useState('');
  const toast = useRef(null);

  const fetchApplications = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = `/api/email?${
        email ? `email=${encodeURIComponent(email)}&` : ''
      }page=${page}&limit=${pagination.limit}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got: ${text.substring(0, 100)}`);
      }
      
      const data = await response.json();
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch applications');
      }
      
      setApplications(data.data || []);
      setPagination(data.pagination || {
        page,
        limit: pagination.limit,
        total: data.data?.length || 0,
        pages: 1
      });
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: err.message,
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [email]);

  const onGlobalFilterChange = (e) => {
    const value = e.target.value;
    let _filters = { ...filters };
    _filters['global'].value = value;
    setFilters(_filters);
    setGlobalFilterValue(value);
  };

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {email ? `Applications for ${email}` : 'All Applications'}
        </h2>
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder="Search applications..."
          />
        </span>
      </div>
    );
  };

  const downloadBodyTemplate = (rowData) => {
    if (!rowData.fileMeta?.fileId) return <span>No file</span>;
    
    return (
      <Button
        icon="pi pi-download"
        className="p-button-rounded p-button-outlined"
        onClick={() => {
          window.open(`/api/email?download=${rowData.fileMeta.fileId}`, '_blank');
        }}
        tooltip="Download File" 
        tooltipOptions={{ position: 'top' }}
      />
    );
  };

  const header = renderHeader();

  if (loading) return <div className="text-center py-8">Loading applications...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  if (!applications.length) return <div className="text-center py-8">No applications found</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <Toast ref={toast} />
      
      <div className="card">
        <DataTable
          value={applications}
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25]}
          loading={loading}
          filters={filters}
          globalFilterFields={['name', 'email', 'location']}
          header={header}
          emptyMessage="No applications found."
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords} entries"
          paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
        >
          <Column field="name" header="Name" sortable />
          <Column field="email" header="Email" sortable />
          <Column field="location" header="Location" sortable />
          <Column 
            header="Download" 
            body={downloadBodyTemplate} 
            style={{ width: '100px' }} 
          />
        </DataTable>
      </div>

      {/* Manual pagination for your API if needed */}
      {pagination.pages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((pageNum) => (
            <Button
              key={pageNum}
              label={String(pageNum)}
              onClick={() => fetchApplications(pageNum)}
              className={`p-button-rounded ${
                pagination.page === pageNum ? '' : 'p-button-outlined'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Application;