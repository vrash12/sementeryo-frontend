import Topbar from "../components/Topbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";

export default function RoleLayout({ base, children }) {
  return (
    <div className="bg-gray-50">
      <Topbar />
      <div className="min-h-screen pt-20 flex">
        <Sidebar base={base} />
        <main className="flex-1 p-4 overflow-y-auto">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
