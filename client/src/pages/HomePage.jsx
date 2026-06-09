import illustration from "@/assets/illustration.svg"
import FormComponent from "@/components/forms/FormComponent"
import AuthComponent from "@/components/forms/AuthComponent"
import useAppContext from "@/hooks/useAppContext"
// import Footer from "@/components/common/Footer";

function HomePage() {
    const { authChecked, currentUser, isAuthenticated } = useAppContext()

    if (currentUser?.token && !authChecked) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_45%),linear-gradient(135deg,#f8fafc_0%,#ffffff_50%,#ecfdf5_100%)] px-4 text-slate-900">
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-lg">
                    Checking your session...
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_45%),linear-gradient(135deg,#f8fafc_0%,#ffffff_50%,#ecfdf5_100%)] px-4 py-10 text-slate-900">
            <div className="my-12 flex w-full max-w-6xl flex-col items-center justify-evenly gap-12 rounded-[32px] border border-white/70 bg-white/75 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur sm:flex-row sm:p-10 sm:pt-10">
                <div className="flex w-full justify-center sm:w-1/2 sm:pl-4">
                    <img
                        src={illustration}
                        alt="Code Connect Illustration"
                        className="mx-auto w-[240px] drop-shadow-[0_24px_40px_rgba(15,23,42,0.12)] sm:w-[420px]"
                    />
                </div>
                <div className="flex w-full items-center justify-center sm:w-1/2">
                    {isAuthenticated ? <FormComponent /> : <AuthComponent />}
                </div>
            </div>
            {/* <Footer /> */}
        </div>
    )
}

export default HomePage
