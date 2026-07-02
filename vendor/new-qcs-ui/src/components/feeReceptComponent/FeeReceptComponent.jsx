'use client';

import React, { useState, useEffect, useContext } from 'react';
import { fillReceiptTemplate } from '@/utils/fillReceipt';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Calendar } from 'primereact/calendar';
import { FloatLabel } from 'primereact/floatlabel';
import { Button } from 'primereact/button';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import { Toast } from 'primereact/toast';
import { useRef } from 'react';
import { Dropdown } from 'primereact/dropdown';
import ReceiptList from './FeeReceptTableComponent';
import { cardcontext } from '@/context/scrollcardcontext';

const FeeReceptComponent = () => {
    const toast = useRef(null);
    const { showTable, setShowTable, prefillData, setPrefillData } = useContext(cardcontext);

    const [formData, setFormData] = useState({
        receiptNo: '',
        date: null,
        studentName: '',
        courseName: '',
        courseFee: null,
        feeReceived: null,
        dueFee: null,
        studentId: '',
    });

    const [formErrors, setFormErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [receiptLoading, setReceiptLoading] = useState(true);
    const [calculatingDue, setCalculatingDue] = useState(false);

    const courseOptions = [
        { label: 'Frontend Development', value: 'Frontend Development' },
        { label: 'Backend Development', value: 'Backend Development' },
        { label: 'Full Stack Development', value: 'Full Stack Development' },
        { label: 'UI/UX Design', value: 'UI/UX Design' },
        { label: 'Network Security', value: 'Network Security' },
        { label: 'Digital Marketing ', value: 'Digital Marketing' }
    ];

    const generateStudentId = async () => {
        try {
            const res = await fetch('/api/fee-receipt/generateStudentId'); // 🔁 your new GET API
            const data = await res.json();
            console.log("data", data.studentId);
            return data.studentId || '';
        } catch (err) {
            console.error('Failed to fetch student ID:', err);
            return '';
        }
    };


    useEffect(() => {
        const initializeForm = async () => {
            const newReceiptNo = await fetchReceiptNumber();

            if (prefillData) {
                setFormData({
                    receiptNo: newReceiptNo,
                    studentId: prefillData.studentId || await generateStudentId(),
                    date: null, // Always reset
                    studentName: prefillData.studentName || '',
                    courseName: prefillData.courseName || '',
                    courseFee: prefillData.courseFee || null,
                    feeReceived: null, // Always empty
                    dueFee: null,       // Always empty
                });
            } else {
                setFormData({
                    receiptNo: newReceiptNo,
                    studentId: await generateStudentId(),
                    date: null,
                    studentName: '',
                    courseName: '',
                    courseFee: null,
                    feeReceived: null,
                    dueFee: null,
                });
            }
        };

        initializeForm();
    }, [prefillData]);

    const handleTextChange = (e, field, value = null) => {
        setFormData(prev => ({
            ...prev,
            [field]: value ?? e.target.value
        }));
    };

    const handleNumberChange = (value, name) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (e) => {
        setFormData((prev) => ({ ...prev, date: e.value }));
    };

    const formatDate = (dateObj) => {
        if (!dateObj) return '';
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yyyy = dateObj.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.date) errors.date = 'Date is required';
        if (!formData.studentName.trim()) errors.studentName = 'Student Name is required';
        if (!formData.courseName.trim()) errors.courseName = 'Course Name is required';
        if (formData.courseFee === null || formData.courseFee === undefined) errors.courseFee = 'Course Fee is required';
        if (formData.feeReceived === null || formData.feeReceived === undefined) errors.feeReceived = 'Fee Received is required';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleDownload = async () => {
        if (!validateForm()) return;

        try {
            setLoading(true);

            const response = await fetch('/templates/Fee_Recipt.pdf');
            const templateBuffer = await response.arrayBuffer();
            const formattedData = {
                receiptNo: String(formData.receiptNo || ''),
                studentId: String(formData.studentId || ''), // 🆕 Include it
                date: formData.date ? formatDate(formData.date) : '',
                studentName: String(formData.studentName || ''),
                courseName: String(formData.courseName || ''),
                courseFee: String(formData.courseFee ?? ''),
                feeReceived: String(formData.feeReceived ?? ''),
                dueFee: String(formData.dueFee ?? ''),
            };


            const filledPdfBytes = await fillReceiptTemplate(templateBuffer, formattedData);

            const pdfBlob = new Blob([filledPdfBytes], { type: 'application/pdf' });
            const form = new FormData();
            form.append('pdf', pdfBlob);
            form.append('meta', JSON.stringify({
                ...formattedData,
                date: formData.date || new Date()
            }));

            await fetch('/api/fee-receipt', {
                method: 'POST',
                body: form,
            });

            await fetch('/api/fee-receipt/generateStudentId', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ studentId: formData.studentId }),
            });

            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${formData.studentName || 'receipt'}.pdf`;
            a.click();

            toast.current.show({
                severity: 'success',
                summary: 'Success',
                detail: 'Fee receipt generated and downloaded',
                life: 3000,
            });

            // 🔥 Increment receipt number AFTER success
            await incrementReceiptNumber();

        } catch (err) {
            console.error('Error:', err);
            toast.current.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to generate receipt',
                life: 3000,
            });
        } finally {
            setLoading(false);
            resetForm();
        }
    };


    const fetchReceiptNumber = async () => {
        try {
            setReceiptLoading(true); // start spinner
            const res = await fetch('/api/fee-receipt/generate-receipt-no');
            const data = await res.json();
            return data.receiptNo || '';
        } catch (err) {
            console.error('Failed to fetch receipt number:', err);
            return '';
        } finally {
            setReceiptLoading(false); // stop spinner
        }
    };

    const incrementReceiptNumber = async () => {
        try {
            const res = await fetch('/api/fee-receipt/generate-receipt-no', {
                method: 'PUT',
            });
            const data = await res.json();
            return data.receiptNo || '';
        } catch (err) {
            console.error('Failed to increment receipt number:', err);
            return '';
        }
    };

    const handleCalculateDueFee = async () => {
        if (!formData.studentId || formData.feeReceived === null || formData.courseFee === null) return;

        try {
            setCalculatingDue(true);

            const res = await fetch('/api/fee-receipt/calculate-due', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    studentId: formData.studentId,
                    currentFeeReceived: formData.feeReceived,
                    courseFee: formData.courseFee,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setFormData((prev) => ({
                    ...prev,
                    dueFee: data.leftFee ?? 0,
                }));
                toast.current.show({
                    severity: 'success',
                    summary: 'Calculated',
                    detail: 'Due fee updated',
                    life: 2000,
                });
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error) {
            toast.current.show({
                severity: 'error',
                summary: 'Error',
                detail: error.message,
                life: 3000,
            });
            console.error('Calculate due error:', error);
        } finally {
            setCalculatingDue(false);

        }
    };

    const resetForm = async () => {
        const newReceiptNo = await fetchReceiptNumber();
        const newStudentId = await generateStudentId();

        setFormData({
            receiptNo: newReceiptNo,
            studentId: newStudentId,
            date: null,
            studentName: '',
            courseName: '',
            courseFee: null,
            feeReceived: null,
            dueFee: null,
        });
        setFormErrors({});
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50! to-amber-100! p-4 md:p-8">
            <Toast ref={toast} />

            {/* Header Section */}
            <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-orange-900! drop-shadow-md">
                        🎓 Academic Fee Manager
                    </h2>
                    <p className="text-orange-700! mt-2">
                        Generate professional fee receipts with our glassmorphic interface
                    </p>
                </div>
                <button
                    onClick={() => setShowTable(true)}
                    className="bg-gradient-to-r from-orange-500! to-amber-500! hover:from-orange-600! hover:to-amber-600! text-white! font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105! border border-orange-300! glass-button"
                >
                    View Receipt History
                </button>
            </div>

            {/* Main Card */}
            <div className="max-w-6xl mx-auto">
                <div className="bg-white/30! backdrop-blur-lg! rounded-3xl! shadow-xl! overflow-hidden border border-orange-200/50! glass-card">
                    {/* Card Header */}
                    <div className="bg-gradient-to-r from-orange-500/20! to-amber-500/20! p-6 border-b border-orange-200/50!">
                        <h2 className="text-2xl md:text-3xl font-bold text-orange-900! flex items-center">
                            <i className="pi pi-receipt mr-3 text-orange-700!"></i>
                            Fee Receipt Generator
                        </h2>
                    </div>

                    {/* Card Body */}
                    <div className="p-6 md:p-10">
                        <div className="space-y-10">
                            {/* Receipt Details */}
                            <div className="glass-panel p-6 rounded-2xl!">
                                <h3 className="text-xl font-bold mb-6 text-orange-800! flex items-center border-b border-orange-200/50! pb-3">
                                    <i className="pi pi-file mr-2"></i>
                                    Receipt Details
                                </h3>
                                <div className="grid md:grid-cols-2 gap-8">
                                    <FloatLabel>
                                        <div className="relative w-full">
                                            <InputText
                                                id="receiptNo"
                                                value={receiptLoading ? 'Generating...' : formData.receiptNo}
                                                disabled
                                                className="w-full bg-orange-50/50! border-b-2! border-orange-300! rounded-t-lg! px-3 py-2 focus:border-orange-500! text-orange-900! shadow-sm!"
                                            />
                                            {receiptLoading && (
                                                <i className="pi pi-spin pi-spinner absolute right-3 top-1/2 transform -translate-y-1/2 text-orange-500! text-sm" />
                                            )}
                                        </div>
                                        <label htmlFor="receiptNo" className="text-orange-700! font-medium">Receipt No</label>
                                    </FloatLabel>

                                    <div>
                                        <FloatLabel>
                                            <Calendar
                                                inputId="date"
                                                value={formData.date}
                                                onChange={handleDateChange}
                                                dateFormat="dd-mm-yy"
                                                showIcon
                                                iconClassName="text-orange-500!"
                                                className="w-full [&>input]:bg-orange-50/50! [&>input]:border-b-2! [&>input]:border-orange-300! [&>input]:rounded-t-lg! [&>input]:px-3 [&>input]:py-2 [&>input]:text-orange-900! [&>input]:shadow-sm!"
                                            />
                                            <label htmlFor="date" className="text-orange-700! font-medium">Date</label>
                                        </FloatLabel>
                                        {formErrors.date && <small className="text-red-500! font-bold block mt-2">{formErrors.date}</small>}
                                    </div>
                                </div>
                            </div>

                            {/* Student Information */}
                            <div className="glass-panel p-6 rounded-2xl!">
                                <h3 className="text-xl font-bold mb-6 text-orange-800! flex items-center border-b border-orange-200/50! pb-3">
                                    <i className="pi pi-user mr-2"></i>
                                    Student Information
                                </h3>
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <FloatLabel>
                                            <InputText
                                                id="studentName"
                                                value={formData.studentName}
                                                onChange={(e) => handleTextChange(e, 'studentName')}
                                                className="w-full bg-orange-50/50! border-b-2! border-orange-300! rounded-t-lg! px-3 py-2 focus:border-orange-500! text-orange-900! shadow-sm!"
                                            />
                                            <label htmlFor="studentName" className="text-orange-700! font-medium">Student Name</label>
                                        </FloatLabel>
                                        {formErrors.studentName && <small className="text-red-500! font-bold block mt-2">{formErrors.studentName}</small>}
                                    </div>

                                    <div>
                                        <FloatLabel>
                                            <Dropdown
                                                id="courseName"
                                                value={formData.courseName}
                                                options={courseOptions}
                                                onChange={(e) => handleTextChange(e, 'courseName', e.value)}
                                                className="min-w-full bg-orange-50/50! border-b-2! border-orange-300! rounded-t-lg! [&>div]:px-3 [&>div]:py-2 text-orange-900! shadow-sm!"
                                                panelClassName="bg-orange-50! border border-orange-200! shadow-lg!"
                                            />
                                            <label htmlFor="courseName" className="text-orange-700! font-medium">Course Name</label>
                                        </FloatLabel>
                                        {formErrors.courseName && (
                                            <small className="text-red-500! font-bold block mt-2">{formErrors.courseName}</small>
                                        )}
                                    </div>

                                    <div>
                                        <FloatLabel>
                                            <InputText
                                                id="studentId"
                                                value={formData.studentId}
                                                disabled
                                                className="w-full bg-orange-50/50! border-b-2! border-orange-300! rounded-t-lg! px-3 py-2 text-orange-900! shadow-sm!"
                                            />
                                            <label htmlFor="studentId" className="text-orange-700! font-medium">Student ID</label>
                                        </FloatLabel>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Information */}
                            <div className="glass-panel p-6 rounded-2xl!">
                                <h3 className="text-xl font-bold mb-6 text-orange-800! flex items-center border-b border-orange-200/50! pb-3">
                                    <i className="pi pi-credit-card mr-2"></i>
                                    Payment Information
                                </h3>
                                <div className="grid md:grid-cols-3 gap-8">
                                    <div>
                                        <FloatLabel>
                                            <InputNumber
                                                id="courseFee"
                                                value={formData.courseFee}
                                                onValueChange={(e) => handleNumberChange(e.value, 'courseFee')}
                                                className="w-full [&>input]:bg-orange-50/50! [&>input]:border-b-2! [&>input]:border-orange-300! [&>input]:rounded-t-lg! [&>input]:px-3 [&>input]:py-2 [&>input]:text-orange-900! [&>input]:shadow-sm!"
                                                mode="decimal"
                                                min={0}
                                            />
                                            <label htmlFor="courseFee" className="text-orange-700! font-medium">Course Fee (₹)</label>
                                        </FloatLabel>
                                        {formErrors.courseFee && <small className="text-red-500! font-bold block mt-2">{formErrors.courseFee}</small>}
                                    </div>

                                    <div>
                                        <FloatLabel>
                                            <InputNumber
                                                id="feeReceived"
                                                value={formData.feeReceived}
                                                onValueChange={(e) => handleNumberChange(e.value, 'feeReceived')}
                                                className="w-full [&>input]:bg-orange-50/50! [&>input]:border-b-2! [&>input]:border-orange-300! [&>input]:rounded-t-lg! [&>input]:px-3 [&>input]:py-2 [&>input]:text-orange-900! [&>input]:shadow-sm!"
                                                mode="decimal"
                                                min={0}
                                            />
                                            <label htmlFor="feeReceived" className="text-orange-700! font-medium">Amount Received (₹)</label>
                                        </FloatLabel>
                                        {formErrors.feeReceived && <small className="text-red-500! font-bold block mt-2">{formErrors.feeReceived}</small>}
                                    </div>

                                    <div className="md:col-span-3">
                                        <FloatLabel>
                                            <InputNumber
                                                id="dueFee"
                                                value={formData.dueFee}
                                                disabled
                                                className="w-full [&>input]:bg-orange-50/50! [&>input]:border-b-2! [&>input]:border-orange-300! [&>input]:rounded-t-lg! [&>input]:px-3 [&>input]:py-2 [&>input]:text-orange-900! [&>input]:font-bold [&>input]:shadow-sm!"
                                                mode="decimal"
                                                min={0}
                                            />
                                            <label htmlFor="dueFee" className="text-orange-700! font-medium">Due Fee (₹)</label>
                                        </FloatLabel>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-10 pt-6 border-t border-orange-200/50!">
                                    <Button
                                        label="Calculate Due Fee"
                                        icon="pi pi-calculator"
                                        onClick={handleCalculateDueFee}
                                        loading={calculatingDue}
                                        disabled={!formData.feeReceived}
                                        className="p-button-primar  y bg-gradient-to-r from-orange-500! to-amber-500! border-orange-400! hover:from-orange-600! hover:to-amber-600! glass-button w-full md:w-auto"
                                        severity="warning"
                                        raised
                                        outlined
                                    />

                                    <Button
                                        label="Download Fee Receipt"
                                        icon="pi pi-download"
                                        loading={loading}
                                        className="p-button-lg bg-gradient-to-r from-orange-500! to-amber-500! border-orange-400! hover:from-orange-600! hover:to-amber-600! text-white! font-bold py-3 glass-button w-full md:w-auto"
                                        onClick={handleDownload}
                                        severity="warning"
                                        raised
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Styles */}
            <style jsx global>{`
                .glass-card {
                    background: rgba(255, 255, 255, 0.25) !important;
                    backdrop-filter: blur(12px) !important;
                    -webkit-backdrop-filter: blur(12px) !important;
                    box-shadow: 0 8px 32px rgba(251, 146, 60, 0.15) !important;
                }
                
                .glass-panel {
                    background: rgba(255, 255, 255, 0.2) !important;
                    backdrop-filter: blur(8px) !important;
                    border: 1px solid rgba(255, 237, 213, 0.5) !important;
                }
                
                .glass-button {
                    backdrop-filter: blur(4px) !important;
                    -webkit-backdrop-filter: blur(4px) !important;
                    transition: all 0.3s ease !important;
                    box-shadow: 0 4px 20px rgba(251, 146, 60, 0.25) !important;
                    border: 1px solid rgba(255, 171, 87, 0.5) !important;
                }
                
                .glass-button:hover {
                    box-shadow: 0 6px 25px rgba(251, 146, 60, 0.4) !important;
                    transform: translateY(-2px) !important;
                }
                
                .p-inputtext:enabled:focus {
                    box-shadow: 0 0 0 2px rgba(251, 146, 60, 0.5) !important;
                    border-color: rgba(251, 146, 60, 0.5) !important;
                }
                
                .p-float-label label {
                    color: #7c2d12 !important;
                    font-weight: 500 !important;
                }
                
                .p-inputnumber-input, 
                .p-inputtext, 
                .p-dropdown {
                    background: rgba(255, 247, 237, 0.5) !important;
                    border-top: none !important;
                    border-left: none !important;
                    border-right: none !important;
                    border-radius: 0 !important;
                    border-bottom: 2px solid #fb923c !important;
                }
                
                .p-calendar .p-inputtext {
                    padding-right: 2.5rem !important;
                }
            `}</style>
        </div>
    );
};

export default FeeReceptComponent;