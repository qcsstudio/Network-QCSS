import Sidebar from "../../components/SidebarComponents/Sidebar";


export default function Layout({ children }) {
  return (
    <>
      <div className="flex">
        <Sidebar />
        {children}
      </div>
    </>
  )
}