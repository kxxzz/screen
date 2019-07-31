#ifdef _MSC_VER
# pragma warning(disable: 4101)
#endif

#include <stdlib.h>
#ifdef _WIN32
# include <crtdbg.h>
#endif

#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

#include <sys/stat.h>
#include <signal.h>

#define HAVE_M_PI
#define SDL_MAIN_HANDLED
#include <SDL.h>
#include <SDL_syswm.h>

#include <argparse.h>


#include <screen.h>
#include <screen_sceneloader_file.h>
#include <screen_configloader_file.h>
#include <screen_fwtch.h>
#include <screen_utils_sdl.h>
#include <screen_console_ws.h>






#ifdef ARYLEN
# undef ARYLEN
#endif
#define ARYLEN(a) (sizeof(a) / sizeof((a)[0]))


#ifdef max
# undef max
#endif
#ifdef min
# undef min
#endif
#define max(a,b) ((a) > (b) ? (a) : (b))
#define min(a,b) ((a) < (b) ? (a) : (b))


#define zalloc(sz) calloc(1, sz)





static int mainReturn(int r)
{
#if !defined(NDEBUG) && defined(_WIN32)
    system("pause");
#endif
    return r;
}






int main(int argc, const char* argv[])
{
#if !defined(NDEBUG) && defined(_WIN32)
    _CrtSetDbgFlag(_CRTDBG_ALLOC_MEM_DF | _CRTDBG_LEAK_CHECK_DF);
#endif
    srand((u32)time(NULL));


    char* sceneFile = NULL;
    char* configFile = NULL;
    int watchFlag = false;
    char* consoleURL = NULL;
    int renderSize = -1;
    struct argparse_option options[] =
    {
        OPT_HELP(),
        OPT_STRING('s', "scene", &sceneFile, "scene file to open"),
        OPT_STRING('c', "config", &configFile, "config file to open"),
        OPT_BOOLEAN('w', "watch", &watchFlag, "watch file and reload it when it changes"),
        OPT_STRING('u', "url", &consoleURL, "Console URL (WebSocket) to connect"),
        OPT_INTEGER(0, "rendersize", &renderSize, "used only when no config file loaded"),
        OPT_END(),
    };
    struct argparse argparse;
    argparse_init(&argparse, options, NULL, 0);
    argc = argparse_parse(&argparse, argc, argv);


    SDL_Init(SDL_INIT_VIDEO);
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
    SDL_GL_SetAttribute(SDL_GL_ACCELERATED_VISUAL, 1);
    SDL_GL_SetAttribute(SDL_GL_RED_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_GREEN_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_BLUE_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_ALPHA_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE, 16);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 4);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 6);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
    // must 0 for glBlitFramebuffer works
    SDL_GL_SetAttribute(SDL_GL_MULTISAMPLESAMPLES, 0);

    u32 winWidth = 800;
    u32 winHeight = 600;
    SDL_Window* window = SDL_CreateWindow
    (
        "SCREEN PLAYER",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, winWidth, winHeight,
        SDL_WINDOW_SHOWN | SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE
    );
#ifdef _WIN32
    HWND hwnd;
    {
        SDL_SysWMinfo wmInfo;
        SDL_VERSION(&wmInfo.version);
        SDL_GetWindowWMInfo(window, &wmInfo);
        hwnd = wmInfo.info.win.window;
    }
#endif
    SDL_GLContext context = SDL_GL_CreateContext(window);
    SCREEN_startup();
    SCREEN_enter(winWidth, winHeight);


    u32 intervalMode = 2;
    bool fullscreen = false;
    bool topMost = true;
    bool stopped = false;


    static const int IntervalTable[] = { 0, 1, -1 };
    int r = SDL_GL_SetSwapInterval(IntervalTable[intervalMode]);
    assert(0 == r);


    if (watchFlag)
    {
        SCREEN_fwtchStartup();
    }
    if (sceneFile)
    {
        char* sceneFile0 = sceneFile;
        sceneFile = malloc(strlen(sceneFile0) + 1);
        memcpy(sceneFile, sceneFile0, strlen(sceneFile0) + 1);

        if (watchFlag)
        {
            SCREEN_fwtchScreenBind(sceneFile);
        }
        else
        {
            SCREEN_loadSceneFile(sceneFile, NULL);
        }
    }
    if (configFile)
    {
        if (watchFlag)
        {
            SCREEN_fwtchConfigBind(configFile);
        }
        else
        {
            SCREEN_loadConfigFile(configFile);
        }
    }
    else if (renderSize > 0)
    {
        SCREEN_RenderSize rs = { SCREEN_RenderSizeMode_Fixed, .size = renderSize };
        SCREEN_setRenderSize(&rs);
    }

    if (consoleURL)
    {
        SCREEN_consoleSetURL(consoleURL);
        SCREEN_consoleStartup();
    }


    if (SCREEN_sceneLoaded())
    {
#ifdef _WIN32
        SetWindowPos(hwnd, topMost ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
#endif
    }


    f32 now0 = (f32)SDL_GetTicks() / 1000.f;
    f32 lastCheckTime = 0;
    u32 frameCount = 0;
    bool outdated = true;


    bool quit = false;
    SDL_Event e;
    while (!quit)
    {
        while (SDL_PollEvent(&e))
        {
            switch (e.type)
            {
            case SDL_WINDOWEVENT:
            {
                switch (e.window.event)
                {
                case SDL_WINDOWEVENT_RESIZED:
                case SDL_WINDOWEVENT_SIZE_CHANGED:
                {
                    outdated = true;
                    SCREEN_resize(e.window.data1, e.window.data2);
                    break;
                }
                }
                break;
            }
            case SDL_DROPFILE:
            {
                char* path = e.drop.file;
                // Shows directory of dropped file
                //SDL_ShowSimpleMessageBox(
                //    SDL_MESSAGEBOX_INFORMATION,
                //    "File dropped on window",
                //    path,
                //    window
                //);
                outdated = true;
                sceneFile = realloc(sceneFile, strlen(path) + 1);
                memcpy(sceneFile, path, strlen(path) + 1);
                SDL_free(path);
                SCREEN_LoadFileError err;
                if (watchFlag)
                {
                    err = SCREEN_fwtchScreenBind(sceneFile);
                }
                else
                {
                    err = SCREEN_loadSceneFile(sceneFile, NULL);
                }
                if (SCREEN_LoadFileError_NONE == err)
                {
#ifdef _WIN32
                    SetWindowPos(hwnd, topMost ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
#endif
                }
                break;
            }
            case SDL_QUIT:
            {
                quit = true;
                break;
            }
            case SDL_MOUSEBUTTONUP:
            {
                if (e.motion.state > 0)
                {
                    outdated = true;
                    //SDL_SetRelativeMouseMode(false);

                    SCREEN_mouseUp(e.button.x, e.button.y);
                }
                break;
            }
            case SDL_MOUSEBUTTONDOWN:
            {
                if (e.motion.state > 0)
                {
                    outdated = true;
                    //SDL_SetRelativeMouseMode(true);

                    SCREEN_mouseDown(e.button.x, e.button.y);
                }
                break;
            }
            case SDL_MOUSEMOTION:
            {
                if (e.motion.state > 0)
                {
                    outdated = true;
                    SCREEN_mouseMotion(e.button.x, e.button.y);
                }
                break;
            }
            case SDL_KEYDOWN:
            {
                outdated = true;
                if (SDLK_ESCAPE == e.key.keysym.sym)
                {
                    fullscreen = !fullscreen;
                    SDL_SetWindowFullscreen(window, fullscreen ? SDL_WINDOW_FULLSCREEN_DESKTOP : 0);
#ifdef _WIN32
                    SetWindowPos(hwnd, topMost ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
#endif
                }
                if (SDLK_F5 == e.key.keysym.sym)
                {
                    topMost = !topMost;
#ifdef _WIN32
                    SetWindowPos(hwnd, topMost ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
#endif
                }
                if (SDLK_F8 == e.key.keysym.sym)
                {
                    fullscreen = !fullscreen;
                    SDL_SetWindowFullscreen(window, fullscreen ? SDL_WINDOW_FULLSCREEN : 0);
#ifdef _WIN32
                    SetWindowPos(hwnd, topMost ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
#endif
                }
                if (SDLK_TAB == e.key.keysym.sym)
                {
                    intervalMode = (intervalMode + 1) % ARYLEN(IntervalTable);
                    int r = SDL_GL_SetSwapInterval(intervalMode);
                    if (0 != r)
                    {
                        // todo
                    }
                }
                if (SDLK_F1 == e.key.keysym.sym)
                {
                    SCREEN_sceneReset();
                }
                if (SDLK_F2 == e.key.keysym.sym)
                {
                    stopped = !stopped;
                }
                SCREEN_Key k = SCREEN_keyFromSdlKeysym(&e.key.keysym);
                SCREEN_keyDown(k);
                break;
            }
            case SDL_KEYUP:
            {
                outdated = true;
                SCREEN_Key k = SCREEN_keyFromSdlKeysym(&e.key.keysym);
                SCREEN_keyUp(k);
                break;
            }
            default:
                break;
            }
        }


        f32 now = (f32)SDL_GetTicks() / 1000.f;


        if (now - lastCheckTime > 0.25f)
        {
            static char title[255] = "";
            snprintf(title, sizeof(title), "SCREEN PLAYER%*c FPS: %-2.2f", 16, ' ', (double)frameCount / (now - lastCheckTime));
            SDL_SetWindowTitle(window, title);
            frameCount = 0;

            lastCheckTime = now;

            if (sceneFile && watchFlag)
            {
                if (SCREEN_fwtchUpdate())
                {
                    outdated = true;
                }
            }
        }

        
        if (!stopped || outdated)
        {
            outdated = false;

            float deltaTime = stopped ? (f32)(1.0 / 60.0) : (now - now0);

            ++frameCount;
            SCREEN_frame(deltaTime, stopped);

            SDL_GL_SwapWindow(window);
            // SDL_Delay(1);
        }
        now0 = now;

        if (consoleURL)
        {
            SCREEN_consoleUpdate();
        }
    }


    if (consoleURL)
    {
        SCREEN_consoleDestroy();
    }
    if (watchFlag)
    {
        SCREEN_fwtchDestroy();
    }
    free(sceneFile);
    SCREEN_destroy();
    SDL_GL_DeleteContext(context);
    SDL_DestroyWindow(window);
    SDL_Quit();
    return mainReturn(EXIT_SUCCESS);
}




































































































