import { Outlet } from "react-router-dom";
import Topbar from "../../../components/Topbar";
import Footer from "../../../components/Footer";

export default function VisitorLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#dff1f7] to-[#e9f0ff]">
      <Topbar />
      <Outlet />
      <Footer />
    </div>
  );
}
