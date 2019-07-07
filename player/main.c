#pragma warning(disable: 4101)

#include <stdlib.h>
#ifdef _WIN32
# include <crtdbg.h>
#endif

#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <ctype.h>

#include <sys/stat.h>
#include <signal.h>

#define HAVE_M_PI
#define SDL_MAIN_HANDLED
#include <SDL.h>

#include <argparse.h>


#include <screen.h>
#include <screen_scene_loader.h>





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





enum
{
    TimeStrBuf_MAX = 16,
};

static char* nowStr(char* timeBuf)
{
    time_t t = time(NULL);
    struct tm *lt = localtime(&t);
    timeBuf[strftime(timeBuf, TimeStrBuf_MAX, "%H:%M:%S", lt)] = '\0';
    return timeBuf;
}







int main(int argc, char* argv[])
{
#if !defined(NDEBUG) && defined(_WIN32)
    _CrtSetDbgFlag(_CRTDBG_ALLOC_MEM_DF | _CRTDBG_LEAK_CHECK_DF);
#endif

    char timeBuf[TimeStrBuf_MAX];


    char* srcFile = NULL;
    int watchFlag = false;
    struct argparse_option options[] =
    {
        OPT_HELP(),
        //OPT_GROUP("Basic options"),
        OPT_STRING('f', "file", &srcFile, "file to open"),
        OPT_BOOLEAN('w', "watch", &watchFlag, "watch file and reload it when it changes"),
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
    SDL_GLContext context = SDL_GL_CreateContext(window);
    SCREEN_startup();
    SCREEN_enter(winWidth, winHeight);


    u32 intervalMode = 2;
    bool fullscreen = false;
    bool lazyMode = false;


    static const int IntervalTable[] = { 0, 1, -1 };
    int r = SDL_GL_SetSwapInterval(IntervalTable[intervalMode]);
    assert(0 == r);


    time_t lastMtime;
    if (srcFile)
    {
        struct stat st;
        stat(srcFile, &st);
        lastMtime = st.st_mtime;
        SCREEN_loadSceneFile(srcFile);
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
                watchFlag = false;
                SCREEN_loadSceneFile(path);
                SDL_free(path);
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
                if (SDLK_BACKSPACE == e.key.keysym.sym)
                {
                    fullscreen = !fullscreen;
                    SDL_SetWindowFullscreen(window, fullscreen ? SDL_WINDOW_FULLSCREEN : 0);
                }
                if (SDLK_TAB == e.key.keysym.sym)
                {
                    intervalMode = ++intervalMode % ARYLEN(IntervalTable);
                    int r = SDL_GL_SetSwapInterval(intervalMode);
                    if (0 != r)
                    {
                        // todo
                    }
                }
                if (SDLK_SPACE == e.key.keysym.sym)
                {
                    lazyMode = !lazyMode;
                }
                break;
            }
            case SDL_KEYUP:
            {
                break;
            }
            default:
                break;
            }
        }


        if (srcFile && (now0 - lastCheckTime > 0.25f))
        {
            static char title[255] = "";
            snprintf(title, sizeof(title), "SCREEN PLAYER%*c FPS: %-2.2f", 16, ' ', (double)frameCount / (now0 - lastCheckTime));
            SDL_SetWindowTitle(window, title);
            frameCount = 0;

            lastCheckTime = now0;

            if (watchFlag)
            {
                struct stat st;
                stat(srcFile, &st);
                if (lastMtime != st.st_mtime)
                {
                    printf("[CHANGE] \"%s\" [%s]\n", srcFile, nowStr(timeBuf));
                    SCREEN_loadSceneFile(srcFile);
                }
                lastMtime = st.st_mtime;
            }
        }



        f32 now = (f32)SDL_GetTicks() / 1000.f;
        f32 deltaTime = lazyMode ? 0 : now - now0;
        now0 = now;
        if (!lazyMode || outdated)
        {
            outdated = false;
            ++frameCount;
            SCREEN_frame(deltaTime);

            SDL_GL_SwapWindow(window);
            // SDL_Delay(1);
        }
    }


    SCREEN_destroy();
    SDL_GL_DeleteContext(context);
    SDL_DestroyWindow(window);
    SDL_Quit();

    return mainReturn(EXIT_SUCCESS);
}




































































































