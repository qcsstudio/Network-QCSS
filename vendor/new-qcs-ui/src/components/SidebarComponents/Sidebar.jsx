'use client';

import { useState, useContext, useEffect } from 'react';
import Cookies from 'js-cookie';
import {
  HomeIcon,
  UserIcon,
  ChartBarIcon,
  ReceiptRefundIcon,
  ChevronLeftIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

import JobPostForm from '../JobPostingComponent/JobPostForm';
import BlogPostForm from '../BlogPostComponent/BlogPostForm';
import Application from '../ApplicationComponent/Application';
import FeeReceptComponent from '../feeReceptComponent/FeeReceptComponent';
import ReceiptList from '../feeReceptComponent/FeeReceptTableComponent';

import { cardcontext } from '@/context/scrollcardcontext';
import { removeToken } from '@/utils/cookies';

// import '@/styles/sidebar.css';

const Sidebar = () => {
  const { showTable, setShowTable } = useContext(cardcontext);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeItem, setActiveItem] = useState('job posts');
  const [role, setRole] = useState(null);

  useEffect(() => {
    setRole(Cookies.get('role') || '');
  }, []);

  const menuItems = [
    { id: 1, name: 'Job Posts', icon: HomeIcon },
    { id: 2, name: 'Blog Posts', icon: UserIcon },
    { id: 3, name: 'Applications', icon: ChartBarIcon },
    { id: 4, name: 'Receipts', icon: ReceiptRefundIcon },
  ];

  const filteredMenuItems = menuItems.filter((item) => {
    if (!role) return true;
    if (role === 'admin') return true;
    if (role === 'hr') return item.name !== 'Blog Posts';
    if (role === 'seo') return item.name === 'Blog Posts';
    return false;
  });

  const renderComponent = () => {
    switch (activeItem) {
      case 'job posts': return <JobPostForm />;
      case 'blog posts': return <BlogPostForm />;
      case 'applications': return <Application />;
      case 'receipts': return showTable ? <ReceiptList /> : <FeeReceptComponent />;
      default: return null;
    }
  };

  const handleLogout = async () => {
    await removeToken();
    Cookies.remove('role');
    window.location.reload();
  };

  return (
    <div className="d-flex vh-100 w-100 main-bg">

      {/* SIDEBAR */}
      <motion.aside
        animate={{ width: isSidebarOpen ? 256 : 80 }}
        transition={{ duration: 0.3 }}
        className="position-fixed top-0 start-0 vh-100 glass-sidebar overflow-hidden"
      >
        {/* HEADER */}
        <div className="d-flex align-items-center justify-content-between p-3">
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.h4
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="fw-bold text-warning m-0"
              >
                Dashboard
              </motion.h4>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="collapse-btn rounded p-1"
          >
            <ChevronLeftIcon className="sidebar-icon" />
          </button>
        </div>

        {/* MENU */}
        <nav className="d-flex flex-column mt-2 gap-1">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.name.toLowerCase();

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveItem(item.name.toLowerCase());
                  if (item.name.toLowerCase() === 'receipts') {
                    setShowTable(false);
                  }
                }}
                className={`sidebar-item d-flex align-items-center gap-3 ${
                  isActive ? 'active' : ''
                }`}
              >
                <Icon className="sidebar-icon" />
                <AnimatePresence>
                  {isSidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          className="sidebar-item logout-btn d-flex align-items-center gap-3 mt-auto"
        >
          <ArrowRightOnRectangleIcon className="sidebar-icon" />
          {isSidebarOpen && <span>Logout</span>}
        </button>
      </motion.aside>

      {/* MAIN CONTENT */}
      <main
        className={`flex-grow-1 overflow-auto p-4 ${
          isSidebarOpen ? 'ms-5 ps-5' : 'ms-3'
        }`}
      >
        {/* MOBILE TOGGLE */}
        <div className="d-md-none mb-3">
          <button
            className="btn btn-warning"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            ☰
          </button>
        </div>

        {renderComponent()}
      </main>
    </div>
  );
};

export default Sidebar;
