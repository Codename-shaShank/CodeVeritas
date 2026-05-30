import { useNavigate } from "react-router-dom"

function ConnectionStatusPage() {
    return (
        <div className="flex h-screen min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
            <ConnectionError />
        </div>
    )
}

const ConnectionError = () => {
    const navigate = useNavigate()
    const reloadPage = () => {
        window.location.reload()
    }

    const gotoHomePage = () => {
        navigate("/")
    }

    return (
        <>
            <span className="whitespace-break-spaces text-lg font-medium text-slate-300">
                Oops! Something went wrong. Please try again
            </span>
            <div className="flex flex-wrap justify-center gap-4">
                <button
                    className="rounded-md bg-primary px-8 py-3 font-bold text-black transition-all hover:brightness-110 hover:shadow-lg cursor-pointer"
                    onClick={reloadPage}
                >
                    Try Again
                </button>
                <button
                    className="rounded-md border border-gray-500 bg-transparent px-8 py-3 font-bold text-white transition-all hover:bg-darkHover cursor-pointer"
                    onClick={gotoHomePage}
                >
                    Go to HomePage
                </button>
            </div>
        </>
    )
}

export default ConnectionStatusPage
