import { AnimatePresence, motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import ISTClock from "../common/ISTClock";
import { NAV_LINKS } from "./Navbar";

export default function Sidebar({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-72 flex-col border-l border-navy-700 bg-navy-800 p-5 lg:hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.2 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="font-extrabold text-white">
                Match<span className="text-gold">IQ</span>
              </span>
              <button onClick={onClose} className="text-2xl text-slate-400" aria-label="Close menu">
                ×
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                      isActive ? "bg-navy-700 text-gold" : "text-slate-300 hover:bg-navy-700/60"
                    }`
                  }
                >
                  <span>{l.icon}</span> {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto border-t border-navy-700 pt-4">
              <ISTClock />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
