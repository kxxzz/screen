#include "screen_console_a.h"





typedef enum SCREEN_Cmd
{
    SCREEN_Cmd_LoadScene = 0,

    SCREEN_CmdCount
} SCREEN_Cmd;




void SCREEN_cmdLoadScene
(
    vec_char* cmdBuf, const SCREEN_Scene* scene, const char* sceneData, u32 sceneDataSize
)
{
    assert(0 == cmdBuf->length);
    vec_push(cmdBuf, SCREEN_Cmd_LoadScene);
    vec_pusharr(cmdBuf, scene, sizeof(*scene));
    vec_pusharr(cmdBuf, &sceneDataSize, sizeof(sceneDataSize));
    vec_pusharr(cmdBuf, sceneData, sceneDataSize);
}




void SCREEN_cmdExecLoadScene(const char* cmd, u32 cmdSize)
{
    assert(SCREEN_Cmd_LoadScene == cmd[0]);
    if (cmdSize < 1 + sizeof(SCREEN_Scene) + sizeof(u32))
    {
        // report error
        return;
    }
    SCREEN_Scene scene[1] = { *(SCREEN_Scene*)(cmd + 1) };
    u32 sceneDataSize = *(u32*)(cmd + 1 + sizeof(SCREEN_Scene));
    if (cmdSize != 1 + sizeof(SCREEN_Scene) + sizeof(u32) + sceneDataSize)
    {
        // report error
        return;
    }
    const char* sceneData = cmd + 1 + sizeof(SCREEN_Scene) + sizeof(u32);
    bool r = SCREEN_loadScene(scene, sceneData, sceneDataSize);
    if (!r)
    {
        // report error
        return;
    }
}































void SCREEN_cmdExec(const char* cmd, u32 cmdSize)
{
    if (cmd[0] >= SCREEN_CmdCount)
    {
        printf("unknown cmd %c", cmd[0]);
        return;
    }
    typedef void(*Exec)(const char* cmd, u32 cmdSize);
    static const Exec table[SCREEN_CmdCount] =
    {
        SCREEN_cmdExecLoadScene,
    };
    table[cmd[0]](cmd, cmdSize);
}






























































































