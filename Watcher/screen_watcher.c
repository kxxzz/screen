#include "screen_watcher.h"
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
    SCREEN_WatchFileVec sceneFiles[1];
    SCREEN_WatchFile configFile[1];
    vec_char pathBuf[1];
    u32 sceneFileIndex;
} SCREEN_WatchContext;

static SCREEN_WatchContext* ctx = NULL;





void SCREEN_watchStartup(void)
{
    assert(!ctx);
    ctx = zalloc(sizeof(SCREEN_WatchContext));
}

void SCREEN_watchDestroy(void)
{
    vec_free(ctx->pathBuf);
    vec_free(ctx->sceneFiles);
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

    SCREEN_WatchFileVec* sceneFiles = ctx->sceneFiles;
    assert(0 == sceneFiles->length);
    vec_char* pathBuf = ctx->pathBuf;
    vec_resize(pathBuf, 0);
    
    SCREEN_LoadSceneFileError err = SCREEN_loadSceneFile(filename, pathBuf);
    if (SCREEN_LoadSceneFileError_NONE == err)
    {
        for (u32 off = 0; off < pathBuf->length;)
        {
            vec_resize(sceneFiles, sceneFiles->length + 1);
            SCREEN_WatchFile* wf = &vec_last(sceneFiles);
            SCREEN_watchFileInit(wf, pathBuf->data + off);
            off += (u32)strlen(pathBuf->data + off) + 1;
            assert(off <= pathBuf->length);
        }
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
    SCREEN_LoadConfigFileError err = SCREEN_loadConfigFile(filename);
    if (SCREEN_LoadConfigFileError_NONE == err)
    {
        SCREEN_WatchFile* configFile = ctx->configFile;
        SCREEN_watchFileInit(configFile, filename);
    }
}







void SCREEN_watchScreenFileStop(void)
{
    if (!ctx->hasSceneFile)
    {
        return;
    }
    ctx->hasSceneFile = false;
    vec_resize(ctx->sceneFiles, 0);
}






void SCREEN_watchConfigFileStop(void)
{
    if (!ctx->hasConfigFile)
    {
        return;
    }
    ctx->hasConfigFile = false;
}










void SCREEN_watchUpdate(void)
{
    assert(ctx);
    bool modified = false;
    if (ctx->hasSceneFile)
    {
        SCREEN_WatchFileVec* sceneFiles = ctx->sceneFiles;
        vec_char* pathBuf = ctx->pathBuf;
        vec_resize(pathBuf, 0);

        ctx->sceneFileIndex = (ctx->sceneFileIndex + 1) % sceneFiles->length;

        modified = SCREEN_watchFileCheckModify(sceneFiles->data + ctx->sceneFileIndex);

        if (modified)
        {
            // todo report
            SCREEN_loadSceneFile(sceneFiles->data[0].path, pathBuf);
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





































































































