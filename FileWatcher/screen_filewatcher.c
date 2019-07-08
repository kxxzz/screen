#include "screen_filewatcher.h"
#include "screen_sceneloader_file.h"
#include "screen_configloader_file.h"
#include "screen_a.h"

#include <sys/stat.h>






typedef struct SCREEN_WatchFile
{
    char path[SCREEN_PATH_MAX];
    time_t mtimeLast;
} SCREEN_WatchFile;

typedef vec_t(SCREEN_WatchFile) SCREEN_WatchFileVec;




typedef struct SCREEN_WatchContext
{
    bool hasSceneFile;
    bool hasConfigFile;
    SCREEN_WatchFile sceneEntryFile[1];
    SCREEN_WatchFileVec sceneDepFiles[1];
    SCREEN_WatchFile configFile[1];
} SCREEN_WatchContext;

static SCREEN_WatchContext* ctx = NULL;





void SCREEN_watchStartup(void)
{
    assert(!ctx);
    ctx = zalloc(sizeof(SCREEN_WatchContext));
}

void SCREEN_watchDestroy(void)
{
    vec_free(ctx->sceneDepFiles);
    free(ctx);
    ctx = NULL;
}









static void SCREEN_watchFileInit(SCREEN_WatchFile* wf, const char* path)
{
    stzncpy(wf->path, path, SCREEN_PATH_MAX);
    struct stat st;
    stat(wf->path, &st);
    wf->mtimeLast = st.st_mtime;
}

static bool SCREEN_watchFileCheckModify(SCREEN_WatchFile* wf)
{
    struct stat st;
    stat(wf->path, &st);
    if (wf->mtimeLast != st.st_mtime)
    {
        wf->mtimeLast = st.st_mtime;
        return true;
    }
    else
    {
        return false;
    }
}







void SCREEN_watchScreenFileStart(const char* filename)
{
    assert(ctx);
    if (ctx->hasSceneFile)
    {
        SCREEN_watchScreenFileStop();
    }
    ctx->hasSceneFile = true;

    SCREEN_WatchFile* sceneEntryFile = ctx->sceneEntryFile;
    SCREEN_WatchFileVec* sceneDepFiles = ctx->sceneDepFiles;
    
    SCREEN_watchFileInit(sceneEntryFile, filename);
    // todo
    for (u32 i = 0; i < sceneDepFiles->length; ++i)
    {
        SCREEN_WatchFile* wf = sceneDepFiles->data + i;
        SCREEN_watchFileInit(wf, NULL);
    }
}







void SCREEN_watchConfigFileStart(const char* filename)
{
    assert(ctx);
    if (ctx->hasConfigFile)
    {
        SCREEN_watchConfigFileStop();
    }
    ctx->hasConfigFile = true;

    SCREEN_WatchFile* configFile = ctx->configFile;
    SCREEN_watchFileInit(configFile, filename);
}







void SCREEN_watchScreenFileStop(void)
{
    if (!ctx->hasSceneFile)
    {
        return;
    }
    ctx->hasSceneFile = false;
    vec_resize(ctx->sceneDepFiles, 0);
}






void SCREEN_watchConfigFileStop(void)
{
    if (!ctx->hasConfigFile)
    {
        return;
    }
    ctx->hasConfigFile = false;
}










void SCREEN_watchFilesRefresh(void)
{
    assert(ctx);
    bool modified = false;
    if (ctx->hasSceneFile)
    {
        SCREEN_WatchFile* sceneEntryFile = ctx->sceneEntryFile;
        SCREEN_WatchFileVec* sceneDepFiles = ctx->sceneDepFiles;

        u32 n = 1 + sceneDepFiles->length;
        for (u32 i = 0; i < n; ++i)
        {
            if (0 == n)
            {
                modified = SCREEN_watchFileCheckModify(sceneEntryFile);
                if (modified) break;
            }
            else
            {
                modified = SCREEN_watchFileCheckModify(sceneDepFiles->data + i + 1);
                if (modified) break;
            }
        }
        if (modified)
        {
            // todo report
            SCREEN_loadSceneFile(sceneEntryFile->path);
        }
    }
    if (ctx->hasConfigFile)
    {
        SCREEN_WatchFile* configFile = ctx->configFile;
        modified = SCREEN_watchFileCheckModify(configFile);
        if (modified)
        {
            // todo report
            SCREEN_loadConfigFile(configFile->path);
        }
    }
}





































































































